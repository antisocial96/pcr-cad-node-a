import { config } from 'dotenv';
config();

export const backendConfig = {
  port: process.env.PORT || 3001,
  elevenlabsApiKey: process.env.VITE_ELEVENLABS_API_KEY,
  elevenlabsAgentId: process.env.VITE_ELEVENLABS_AGENT_ID,
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  webhookSecret: process.env.ELEVENLABS_WEBHOOK_SECRET // For webhook verification
};