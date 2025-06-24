import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root directory
config({ path: join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('Environment check:', {
  hasSupabaseUrl: !!supabaseUrl,
  hasSupabaseKey: !!supabaseKey,
  nodeEnv: process.env.NODE_ENV
});

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables:');
  console.error('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('SUPABASE_ANON_KEY:', supabaseKey ? 'Set' : 'Missing');
  throw new Error('Missing required Supabase environment variables. Please check your .env file.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Test connection
supabase.from('garuda_sentry_calls').select('count', { count: 'exact', head: true })
  .then(({ error }) => {
    if (error) {
      console.error('Supabase connection test failed:', error.message);
    } else {
      console.log('✅ Supabase connection successful');
    }
  });

// Database operations for emergency calls
export const garudaSentryCallsDB = {
  // Create a new emergency call record
  async create(callData) {
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .insert([{
        conversation_id: callData.conversation_id,
        intent: callData.intent || 'unknown',
        caller_phone: callData.caller_phone
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating garuda sentry call:', error);
      throw error;
    }

    return data;
  },

  // Get emergency call by conversation ID
  async getByConversationId(conversationId) {
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching garuda sentry call:', error);
      throw error;
    }

    return data;
  },

  // Update emergency call
  async update(conversationId, updates) {
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .update(updates)
      .eq('conversation_id', conversationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating garuda sentry call:', error);
      throw error;
    }

    return data;
  },

  // Get all emergency calls with optional filtering
  async getAll(filters = {}) {
    let query = supabase
      .from('garuda_sentry_calls')
      .select('*')
      .order('timestamp', { ascending: false });

    // Apply filters
    if (filters.intent) {
      query = query.eq('intent', filters.intent);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching garuda sentry calls:', error);
      throw error;
    }

    return data;
  }
};