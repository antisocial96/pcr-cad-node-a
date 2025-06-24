# PCR CAD Backend - Webhook Setup

## ElevenLabs Post-Call Webhook Configuration

### Webhook Endpoint
- **URL**: `https://webhook.auxill.ai/api/webhook/elevenlabs/post-call`
- **Method**: POST
- **Name**: garuda-sentry-post-call

### Local Development
- **Local URL**: `http://localhost:3001/api/webhook/elevenlabs/post-call`
- **Health Check**: `http://localhost:3001/api/webhook/elevenlabs/health`

### Environment Variables Required

Add these to your `.env` file:

```env
# ElevenLabs Configuration
VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key
VITE_ELEVENLABS_AGENT_ID=your_agent_id
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret_optional

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Server Configuration
PORT=3001
```

### Webhook Data Processing

The webhook endpoint will:

1. **Verify Signature** (if `ELEVENLABS_WEBHOOK_SECRET` is configured)
2. **Extract Conversation ID** from the webhook payload
3. **Update Existing Records** or create new ones in the `garuda_sentry_calls` table
4. **Map ElevenLabs Data** to your database schema:
   - `conversation_id` → `conversation_id`
   - `intent` → `intent`
   - `conversation_data.caller_phone` → `caller_phone`

### Testing the Webhook

1. **Health Check**:
   ```bash
   curl http://localhost:3001/api/webhook/elevenlabs/health
   ```

2. **Test Webhook** (simulate ElevenLabs payload):
   ```bash
   curl -X POST http://localhost:3001/api/webhook/elevenlabs/post-call \
     -H "Content-Type: application/json" \
     -d '{
       "conversation_id": "test_conv_123",
       "intent": "emergency_medical",
       "conversation_data": {
         "caller_phone": "+1234567890"
       }
     }'
   ```

### Cloudflare Tunnel Configuration

Since you already have a working Cloudflare tunnel, ensure it's configured to route:
- `https://webhook.auxill.ai/api/webhook/elevenlabs/post-call` → `http://localhost:3001/api/webhook/elevenlabs/post-call`

### Next Steps

1. Configure the webhook in ElevenLabs dashboard with the URL: `https://webhook.auxill.ai/api/webhook/elevenlabs/post-call`
2. Add the webhook secret to your `.env` file if you want signature verification
3. Test the webhook with a real conversation to ensure data flows correctly