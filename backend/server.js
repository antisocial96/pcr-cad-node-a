import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
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

// ElevenLabs post-call webhook endpoint
app.post("/api/webhook/elevenlabs/post-call", async (req, res) => {
    try {
        console.log('Received ElevenLabs post-call webhook:', JSON.stringify(req.body, null, 2));
        
        const webhookData = req.body;
        
        // Extract conversation_id from webhook payload
        const conversationId = webhookData.conversation_id;
        
        if (!conversationId) {
            console.error('No conversation_id found in webhook payload');
            return res.status(400).json({ error: 'Missing conversation_id in webhook payload' });
        }
        
        // Check if the call record exists
        try {
            const existingCall = await garudaSentryCalls.getByConversationId(conversationId);
            console.log('Found existing call record:', existingCall.id);
            
            // Update the call record with webhook data
            const updatedCall = await garudaSentryCalls.updateFromWebhook(conversationId, webhookData);
            console.log('Updated call record with webhook data:', updatedCall);
            
            res.status(200).json({ 
                success: true, 
                message: 'Webhook processed successfully',
                updated_call: updatedCall
            });
            
        } catch (fetchError) {
            // If call record doesn't exist, create a new one
            console.log('Call record not found, creating new record for conversation:', conversationId);
            
            const newCallData = {
                conversation_id: conversationId,
                intent: webhookData.status || 'webhook_received',
                caller_phone: webhookData.caller_phone || webhookData.phone_number || null
            };
            
            const newCall = await garudaSentryCalls.create(newCallData);
            console.log('Created new call record from webhook:', newCall);
            
            res.status(200).json({ 
                success: true, 
                message: 'New call record created from webhook',
                created_call: newCall
            });
        }
        
    } catch (error) {
        console.error('Error processing ElevenLabs webhook:', error);
        res.status(500).json({ 
            error: 'Failed to process webhook',
            details: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
  console.log(`PCR Backend server running on http://localhost:${PORT}`);
  console.log(`Webhook endpoint available at: http://localhost:${PORT}/api/webhook/elevenlabs/post-call`);
});