import { createClient } from '@supabase/supabase-js';
import { backendConfig } from './config.js';

// Create Supabase client with service role key for backend operations
export const supabase = createClient(
  backendConfig.supabaseUrl,
  backendConfig.supabaseServiceRoleKey
);

// Database operations for garuda_sentry_calls table (backend version)
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

  // Update call with post-call data
  async updatePostCallData(conversationId, postCallData) {
    const updateData = {};
    
    // Map ElevenLabs post-call data to our schema
    if (postCallData.intent) {
      updateData.intent = postCallData.intent;
    }
    
    // Extract phone number if available in the conversation data
    if (postCallData.conversation_data && postCallData.conversation_data.caller_phone) {
      updateData.caller_phone = postCallData.conversation_data.caller_phone;
    }

    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .update(updateData)
      .eq('conversation_id', conversationId)
      .select();
    
    if (error) {
      console.error('Error updating call with post-call data:', error);
      throw error;
    }
    
    return data[0];
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
  }
};