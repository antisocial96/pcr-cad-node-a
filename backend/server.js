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

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'PCR Backend API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      signedUrl: '/api/get-signed-url',
      createCall: '/api/calls/create',
      getAllCalls: '/api/calls',
      getCall: '/api/calls/:conversationId',
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

// Get all calls endpoint
app.get("/api/calls", async (req, res) => {
    try {
        console.log('Fetching all call records');
        
        const calls = await garudaSentryCalls.getAll();
        console.log(`Retrieved ${calls.length} call records`);
        
        res.json(calls);
        
    } catch (error) {
        console.error('Error fetching call records:', error);
        res.status(500).json({ 
            error: 'Failed to fetch call records',
            details: error.message
        });
    }
});

// Get call by conversation ID endpoint
app.get("/api/calls/:conversationId", async (req, res) => {
    try {
        const { conversationId } = req.params;
        console.log(`Fetching call record for conversation: ${conversationId}`);
        
        const call = await garudaSentryCalls.getByConversationId(conversationId);
        console.log('Retrieved call record:', call);
        
        res.json(call);
        
    } catch (error) {
        console.error('Error fetching call record:', error);
        res.status(500).json({ 
            error: 'Failed to fetch call record',
            details: error.message
        });
    }
});

// Start server
app.listen(PORT, '::', () => {
  console.log(`PCR Backend server running on http://localhost:${PORT}`);
  console.log(`Server accessible on IPV6:${PORT}`);
});