import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import crypto from 'crypto';
import { garudaSentryCalls } from './utils/supabaseClient.js';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'PCR Backend is running' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'PCR Backend API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      signedUrl: '/api/get-signed-url',
      webhook: '/api/webhook/elevenlabs/post-call',
      createCall: '/api/calls/create',
      updateIntent: '/api/calls/:conversationId/intent',
      updatePhone: '/api/calls/:conversationId/phone'
    }
  });
});

// ElevenLabs signed URL endpoint
app.get("/api/get-signed-url", async (req, res) => {
    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${process.env.VITE_ELEVENLABS_AGENT_ID}`,
            {
                headers: {
                    "xi-api-key": process.env.VITE_ELEVENLABS_API_KEY,
                },
            }
        );

        if (!response.ok) {
            throw new Error("Failed to get signed URL");
        }

        const data = await response.json();
        res.json({ signedUrl: data.signed_url });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Failed to generate signed URL" });
    }
});

// Helper function to construct and verify webhook event
const constructWebhookEvent = async (req, secret) => {
    const body = req.rawBody;
    const signature_header = req.headers['elevenlabs-signature'];
    
    if (!signature_header) {
        return { event: null, error: "Missing signature header" };
    }

    const headers = signature_header.split(",");
    const timestamp = headers.find((e) => e.startsWith("t="))?.substring(2);
    const signature = headers.find((e) => e.startsWith("v0="));

    if (!timestamp || !signature) {
        return { event: null, error: "Invalid signature format" };
    }

    // Validate timestamp (30 minute tolerance)
    const reqTimestamp = Number(timestamp) * 1000;
    const tolerance = Date.now() - 30 * 60 * 1000;
    if (reqTimestamp < tolerance) {
        return { event: null, error: "Request expired" };
    }

    // Validate hash
    const message = `${timestamp}.${body}`;

    if (!secret) {
        return { event: null, error: "Webhook secret not configured" };
    }

    const digest = "v0=" + crypto.createHmac("sha256", secret).update(message).digest("hex");
    
    if (signature !== digest) {
        return { event: null, error: "Invalid signature" };
    }

    const event = JSON.parse(body);
    return { event, error: null };
};

// Middleware to capture raw body for webhook signature verification
app.use('/api/webhook/elevenlabs/post-call', express.raw({ type: 'application/json' }), (req, res, next) => {
    req.rawBody = req.body.toString();
    req.body = JSON.parse(req.rawBody);
    next();
});

// ElevenLabs post-call webhook endpoint with signature verification
app.get("/api/webhook/elevenlabs/post-call", (req, res) => {
    res.json({ status: "webhook listening" });
});

app.post("/api/webhook/elevenlabs/post-call", async (req, res) => {
    try {
        const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
        const { event, error } = await constructWebhookEvent(req, secret);
        
        if (error) {
            console.error('Webhook verification failed:', error);
            return res.status(401).json({ error: error });
        }

        // Store and log the entire JSON payload for debugging
        const completePayload = event;
        console.log('=== COMPLETE WEBHOOK PAYLOAD ===');
        console.log(JSON.stringify(completePayload, null, 2));
        console.log('=== END PAYLOAD ===');

        console.log('Verified ElevenLabs post-call webhook:', JSON.stringify(event, null, 2));
        
        // Handle post_call_transcription event
        if (event.type === "post_call_transcription") {
            console.log("Post-call transcription event data:", JSON.stringify(event.data, null, 2));
            
            const webhookData = event.data;
            
            // Extract conversation_id from data.conversation_id
            const conversationId = webhookData.conversation_id;
            
            if (!conversationId) {
                console.error('No conversation_id found in webhook payload');
                return res.status(400).json({ error: 'Missing conversation_id in webhook payload' });
            }
            
            console.log('Processing webhook for conversation ID:', conversationId);
            
            // Check if the call record exists
            try {
                const existingCall = await garudaSentryCalls.getByConversationId(conversationId);
                console.log('Found existing call record for conversation:', conversationId);
                
                // Update the call record with webhook data
                const updatedCall = await garudaSentryCalls.updateFromWebhook(conversationId, webhookData);
                console.log('Updated call record with webhook data:', updatedCall);
                
                // Log the extracted intent for debugging
                if (webhookData.analysis?.data_collection_results?.intent) {
                    console.log('Extracted intent from webhook:', webhookData.analysis.data_collection_results.intent);
                }
                
                return res.status(200).json({ 
                    received: true,
                    success: true, 
                    message: 'Webhook processed successfully',
                    updated_call: updatedCall
                });
                
            } catch (fetchError) {
                // If call record doesn't exist, create a new one with the real conversation ID
                console.log('Call record not found, creating new record for ElevenLabs conversation:', conversationId);
                
                const newCallData = {
                    conversation_id: conversationId,
                    intent: webhookData.analysis?.data_collection_results?.intent || 'unknown',
                    caller_phone: webhookData.caller_phone || webhookData.phone_number || null,
                    timestamp: webhookData.event_timestamp ? new Date(webhookData.event_timestamp).toISOString() : null
                };
                
                const newCall = await garudaSentryCalls.create(newCallData);
                console.log('Created new call record from webhook with real conversation ID:', newCall);
                
                return res.status(200).json({ 
                    received: true,
                    success: true, 
                    message: 'New call record created from webhook with real conversation ID',
                    created_call: newCall
                });
            }
        }
        
        // For other event types, just acknowledge receipt
        console.log('Received webhook event type:', event.type);
        return res.status(200).json({ received: true });
        
    } catch (error) {
        console.error('Error processing ElevenLabs webhook:', error);
        return res.status(500).json({ 
            error: 'Failed to process webhook',
            details: error.message
        });
    }
});

// Create call record endpoint
app.post("/api/calls/create", async (req, res) => {
    try {
        console.log('Creating new call record:', req.body);
        
        const callData = req.body;
        
        // Validate required fields
        if (!callData.conversation_id) {
            return res.status(400).json({ error: 'Missing conversation_id' });
        }
        
        const newCall = await garudaSentryCalls.create(callData);
        console.log('Created call record:', newCall);
        
        res.status(201).json(newCall);
        
    } catch (error) {
        console.error('Error creating call record:', error);
        res.status(500).json({ 
            error: 'Failed to create call record',
            details: error.message
        });
    }
});

// Update call intent endpoint
app.put("/api/calls/:conversationId/intent", async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { intent } = req.body;
        
        console.log(`Updating intent for conversation ${conversationId} to:`, intent);
        
        const updatedCall = await garudaSentryCalls.updateIntent(conversationId, intent);
        console.log('Updated call intent:', updatedCall);
        
        res.json(updatedCall);
        
    } catch (error) {
        console.error('Error updating call intent:', error);
        res.status(500).json({ 
            error: 'Failed to update call intent',
            details: error.message
        });
    }
});

// Update caller phone endpoint
app.put("/api/calls/:conversationId/phone", async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { caller_phone } = req.body;
        
        console.log(`Updating caller phone for conversation ${conversationId} to:`, caller_phone);
        
        const updatedCall = await garudaSentryCalls.updateCallerPhone(conversationId, caller_phone);
        console.log('Updated caller phone:', updatedCall);
        
        res.json(updatedCall);
        
    } catch (error) {
        console.error('Error updating caller phone:', error);
        res.status(500).json({ 
            error: 'Failed to update caller phone',
            details: error.message
        });
    }
});

// Start server
app.listen(PORT, '::', () => {
  console.log(`PCR Backend server running on http://localhost:${PORT}`);
  console.log(`Server accessible on IPv6 at http://[::]:${PORT}`);
  console.log(`Webhook endpoint available at: http://localhost:${PORT}/api/webhook/elevenlabs/post-call`);
  console.log(`Webhook secret configured: ${process.env.ELEVENLABS_WEBHOOK_SECRET ? 'Yes' : 'No'}`);
});