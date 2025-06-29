import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  }
};