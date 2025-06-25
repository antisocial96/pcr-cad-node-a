import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing required Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Database operations for garuda_sentry_calls table
export const garudaSentryCalls = {
  // Create a new call record
  async create(callData) {
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .insert([callData])
      .select();
    
    if (error) {
      console.error('Error creating call record:', error);
      throw error;
    }
    
    return data[0];
  },

  // Get all calls
  async getAll() {
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.error('Error fetching calls:', error);
      throw error;
    }
    
    return data;
  },

  // Get call by conversation ID
  async getByConversationId(conversationId) {
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();
    
    if (error) {
      console.error('Error fetching call by conversation ID:', error);
      throw error;
    }
    
    return data;
  },

  // Update call intent
  async updateIntent(conversationId, intent) {
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .update({ intent })
      .eq('conversation_id', conversationId)
      .select();
    
    if (error) {
      console.error('Error updating call intent:', error);
      throw error;
    }
    
    return data[0];
  },

  // Update caller phone
  async updateCallerPhone(conversationId, callerPhone) {
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .update({ caller_phone: callerPhone })
      .eq('conversation_id', conversationId)
      .select();
    
    if (error) {
      console.error('Error updating caller phone:', error);
      throw error;
    }
    
    return data[0];
  },

  // Get calls by intent
  async getByIntent(intent) {
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .select('*')
      .eq('intent', intent)
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.error('Error fetching calls by intent:', error);
      throw error;
    }
    
    return data;
  },

  // Update call with webhook data
  async updateFromWebhook(conversationId, webhookData) {
    const updateData = {};
    
    // Extract intent from data.analysis.data_collection_results.intent
    if (webhookData.analysis?.data_collection_results?.intent) {
      updateData.intent = webhookData.analysis.data_collection_results.intent;
    } else {
      // Fallback to 'unknown' if intent not found in expected path
      updateData.intent = 'unknown';
    }

    // Extract caller phone if available in webhook data
    if (webhookData.caller_phone || webhookData.phone_number) {
      updateData.caller_phone = webhookData.caller_phone || webhookData.phone_number;
    }

    // Extract timestamp from event_timestamp
    if (webhookData.event_timestamp) {
      updateData.timestamp = new Date(webhookData.event_timestamp).toISOString();
    }
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .update(updateData)
      .eq('conversation_id', conversationId)
      .select();
    
    if (error) {
      console.error('Error updating call from webhook:', error);
      throw error;
    }
    
    return data[0];
  }
};