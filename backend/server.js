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
    console.log('🔍 GET request to webhook endpoint - health check');
    res.json({ status: "webhook listening" });
});

app.post("/api/webhook/elevenlabs/post-call", async (req, res) => {
    console.log('\n🚀 ===== WEBHOOK POST REQUEST RECEIVED =====');
    console.log('📅 Timestamp:', new Date().toISOString());
    console.log('🌐 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('📦 Raw body length:', req.rawBody?.length || 0);
    
    try {
        const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
        console.log('🔐 Webhook secret configured:', secret ? '✅ Yes' : '❌ No');
        
        const { event, error } = await constructWebhookEvent(req, secret);
        
        if (error) {
            console.error('❌ WEBHOOK VERIFICATION FAILED:', error);
            console.log('🔚 ===== WEBHOOK REQUEST ENDED (FAILED) =====\n');
            return res.status(401).json({ error: error });
        }

        console.log('✅ WEBHOOK VERIFICATION SUCCESSFUL');
        console.log('📋 Event type:', event.type);
        console.log('📄 Full event data:', JSON.stringify(event, null, 2));
        
        // Handle post_call_transcription event
        if (event.type === "post_call_transcription") {
            console.log('\n📞 PROCESSING POST-CALL TRANSCRIPTION EVENT');
            console.log('📊 Event data:', JSON.stringify(event.data, null, 2));
            
            const webhookData = event.data;
            
            // Extract conversation_id from webhook payload
            const conversationId = webhookData.conversation_id;
            console.log('🆔 Conversation ID:', conversationId);
            
            if (!conversationId) {
                console.error('❌ CRITICAL ERROR: No conversation_id found in webhook payload');
                console.log('🔚 ===== WEBHOOK REQUEST ENDED (ERROR) =====\n');
                return res.status(400).json({ error: 'Missing conversation_id in webhook payload' });
            }
            
            // Check if the call record exists
            console.log('🔍 Checking if call record exists for conversation:', conversationId);
            try {
                const existingCall = await garudaSentryCalls.getByConversationId(conversationId);
                console.log('✅ FOUND EXISTING CALL RECORD');
                console.log('📋 Call ID:', existingCall.id);
                console.log('📋 Current intent:', existingCall.intent);
                console.log('📋 Current phone:', existingCall.caller_phone);
                
                // Update the call record with webhook data
                console.log('🔄 Updating existing call record with webhook data...');
                const updatedCall = await garudaSentryCalls.updateFromWebhook(conversationId, webhookData);
                console.log('✅ SUCCESSFULLY UPDATED CALL RECORD');
                console.log('📋 Updated call data:', JSON.stringify(updatedCall, null, 2));
                console.log('🔚 ===== WEBHOOK REQUEST ENDED (SUCCESS - UPDATED) =====\n');
                
                return res.status(200).json({ 
                    received: true,
                    success: true, 
                    message: 'Webhook processed successfully',
                    updated_call: updatedCall
                });
                
            } catch (fetchError) {
                // If call record doesn't exist, create a new one
                console.log('⚠️  CALL RECORD NOT FOUND - Creating new record');
                console.log('🆔 Conversation ID:', conversationId);
                console.log('📝 Fetch error details:', fetchError.message);
                
                const newCallData = {
                    conversation_id: conversationId,
                    intent: webhookData.status || 'webhook_received',
                    caller_phone: webhookData.caller_phone || webhookData.phone_number || null
                };
                console.log('📦 New call data to create:', JSON.stringify(newCallData, null, 2));
                
                console.log('🔄 Creating new call record...');
                const newCall = await garudaSentryCalls.create(newCallData);
                console.log('✅ SUCCESSFULLY CREATED NEW CALL RECORD');
                console.log('📋 New call data:', JSON.stringify(newCall, null, 2));
                console.log('🔚 ===== WEBHOOK REQUEST ENDED (SUCCESS - CREATED) =====\n');
                
                return res.status(200).json({ 
                    received: true,
                    success: true, 
                    message: 'New call record created from webhook',
                    created_call: newCall
                });
            }
        }
        
        // For other event types, just acknowledge receipt
        console.log('ℹ️  RECEIVED OTHER EVENT TYPE:', event.type);
        console.log('✅ Acknowledging receipt without processing');
        console.log('🔚 ===== WEBHOOK REQUEST ENDED (ACKNOWLEDGED) =====\n');
        return res.status(200).json({ received: true });
        
    } catch (error) {
        console.error('💥 CRITICAL ERROR PROCESSING WEBHOOK');
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        console.log('🔚 ===== WEBHOOK REQUEST ENDED (CRITICAL ERROR) =====\n');
        return res.status(500).json({ 
            error: 'Failed to process webhook',
            details: error.message
        });
    }
});

// Create call record endpoint
app.post("/api/calls/create", async (req, res) => {
    console.log('\n📞 ===== CREATE CALL RECORD REQUEST =====');
    console.log('📅 Timestamp:', new Date().toISOString());
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
    
    try {
        const callData = req.body;
        
        // Validate required fields
        if (!callData.conversation_id) {
            console.error('❌ VALIDATION ERROR: Missing conversation_id');
            console.log('🔚 ===== CREATE CALL REQUEST ENDED (VALIDATION ERROR) =====\n');
            return res.status(400).json({ error: 'Missing conversation_id' });
        }
        
        console.log('✅ Validation passed - creating call record...');
        console.log('🆔 Conversation ID:', callData.conversation_id);
        console.log('📋 Intent:', callData.intent || 'unknown');
        console.log('📞 Caller phone:', callData.caller_phone || 'not provided');
        
        const newCall = await garudaSentryCalls.create(callData);
        console.log('✅ SUCCESSFULLY CREATED CALL RECORD');
        console.log('📋 Created call data:', JSON.stringify(newCall, null, 2));
        console.log('🔚 ===== CREATE CALL REQUEST ENDED (SUCCESS) =====\n');
        
        res.status(201).json(newCall);
        
    } catch (error) {
        console.error('💥 ERROR CREATING CALL RECORD');
        console.error('❌ Error message:', error.message);
        console.error('❌ Error details:', error);
        console.log('🔚 ===== CREATE CALL REQUEST ENDED (ERROR) =====\n');
        res.status(500).json({ 
            error: 'Failed to create call record',
            details: error.message
        });
    }
});

// Update call intent endpoint
app.put("/api/calls/:conversationId/intent", async (req, res) => {
    console.log('\n🎯 ===== UPDATE CALL INTENT REQUEST =====');
    console.log('📅 Timestamp:', new Date().toISOString());
    
    try {
        const { conversationId } = req.params;
        const { intent } = req.body;
        
        console.log('🆔 Conversation ID:', conversationId);
        console.log('🎯 New intent:', intent);
        console.log('🔄 Updating call intent...');
        
        const updatedCall = await garudaSentryCalls.updateIntent(conversationId, intent);
        console.log('✅ SUCCESSFULLY UPDATED CALL INTENT');
        console.log('📋 Updated call data:', JSON.stringify(updatedCall, null, 2));
        console.log('🔚 ===== UPDATE INTENT REQUEST ENDED (SUCCESS) =====\n');
        
        res.json(updatedCall);
        
    } catch (error) {
        console.error('💥 ERROR UPDATING CALL INTENT');
        console.error('❌ Error message:', error.message);
        console.error('❌ Error details:', error);
        console.log('🔚 ===== UPDATE INTENT REQUEST ENDED (ERROR) =====\n');
        res.status(500).json({ 
            error: 'Failed to update call intent',
            details: error.message
        });
    }
});

// Update caller phone endpoint
app.put("/api/calls/:conversationId/phone", async (req, res) => {
    console.log('\n📞 ===== UPDATE CALLER PHONE REQUEST =====');
    console.log('📅 Timestamp:', new Date().toISOString());
    
    try {
        const { conversationId } = req.params;
        const { caller_phone } = req.body;
        
        console.log('🆔 Conversation ID:', conversationId);
        console.log('📞 New caller phone:', caller_phone);
        console.log('🔄 Updating caller phone...');
        
        const updatedCall = await garudaSentryCalls.updateCallerPhone(conversationId, caller_phone);
        console.log('✅ SUCCESSFULLY UPDATED CALLER PHONE');
        console.log('📋 Updated call data:', JSON.stringify(updatedCall, null, 2));
        console.log('🔚 ===== UPDATE PHONE REQUEST ENDED (SUCCESS) =====\n');
        
        res.json(updatedCall);
        
    } catch (error) {
        console.error('💥 ERROR UPDATING CALLER PHONE');
        console.error('❌ Error message:', error.message);
        console.error('❌ Error details:', error);
        console.log('🔚 ===== UPDATE PHONE REQUEST ENDED (ERROR) =====\n');
        res.status(500).json({ 
            error: 'Failed to update caller phone',
            details: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
  console.log('\n🚀 ===== PCR BACKEND SERVER STARTED =====');
  console.log('📅 Startup time:', new Date().toISOString());
  console.log('🌐 Server URL:', `http://localhost:${PORT}`);
  console.log('🔗 Health check:', `http://localhost:${PORT}/health`);
  console.log('🪝 Webhook endpoint:', `http://localhost:${PORT}/api/webhook/elevenlabs/post-call`);
  console.log('🔐 Webhook secret configured:', process.env.ELEVENLABS_WEBHOOK_SECRET ? '✅ Yes' : '❌ No');
  console.log('🗄️  Supabase URL configured:', process.env.SUPABASE_URL ? '✅ Yes' : '❌ No');
  console.log('🔑 Supabase service role configured:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Yes' : '❌ No');
  console.log('🎤 ElevenLabs agent ID configured:', process.env.VITE_ELEVENLABS_AGENT_ID ? '✅ Yes' : '❌ No');
  console.log('🔑 ElevenLabs API key configured:', process.env.VITE_ELEVENLABS_API_KEY ? '✅ Yes' : '❌ No');
  console.log('✅ Server ready to accept requests');
  console.log('==========================================\n');
});