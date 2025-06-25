import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { garudaSentryCalls } from './utils/supabaseClient.js';

config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'PCR Backend is running' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'PCR Backend API Server',
    version: '1.0.0'
  });
});

// ElevenLabs signed URL
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
        console.error("Error getting signed URL:", error);
        res.status(500).json({ error: "Failed to generate signed URL" });
    }
});

// Get all calls
app.get("/api/calls", async (req, res) => {
    try {
        const calls = await garudaSentryCalls.getAll();
        res.json(calls);
    } catch (error) {
        console.error('Error fetching calls:', error);
        res.status(500).json({ 
            error: 'Failed to fetch call records',
            details: error.message
        });
    }
});

// Get call by conversation ID
app.get("/api/calls/:conversationId", async (req, res) => {
    try {
        const { conversationId } = req.params;
        const call = await garudaSentryCalls.getByConversationId(conversationId);
        res.json(call);
    } catch (error) {
        console.error('Error fetching call:', error);
        res.status(500).json({ 
            error: 'Failed to fetch call record',
            details: error.message
        });
    }
});

app.listen(PORT, '::', () => {
  console.log(`PCR Backend server running on http://localhost:${PORT}`);
});