import express from 'express';
import cors from 'cors';
import { backendConfig } from './config.js';
import { handlePostCallWebhook, webhookHealthCheck } from './webhooks/elevenlabs.js';

const app = express();
const PORT = backendConfig.port;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'PCR Backend is running' });
});

// Webhook endpoints
app.post('/api/webhook/elevenlabs/post-call', handlePostCallWebhook);
app.get('/api/webhook/elevenlabs/health', webhookHealthCheck);

// ElevenLabs signed URL endpoint
app.get("/api/get-signed-url", async (req, res) => {
    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${backendConfig.elevenlabsAgentId}`,
            {
                headers: {
                    "xi-api-key": backendConfig.elevenlabsApiKey,
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

// Start server
app.listen(PORT, () => {
  console.log(`PCR Backend server running on http://localhost:${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhook/elevenlabs/post-call`);
  console.log(`Webhook health check: http://localhost:${PORT}/api/webhook/elevenlabs/health`);
});