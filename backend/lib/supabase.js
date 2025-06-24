import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase environment variables. Some features may not work.');
  // Create a mock client for development
  const mockClient = {
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }) }) }),
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }) }) }) }),
      order: () => Promise.resolve({ data: [], error: null })
    })
  };
  
  export const supabase = mockClient;
} else {
  // Create Supabase client
  export const supabase = createClient(supabaseUrl, supabaseKey);
}

// Database operations for emergency calls
export const garudaSentryCallsDB = {
  // Create a new emergency call record
  async create(callData) {
    try {
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
    } catch (error) {
      console.error('Database operation failed:', error);
      // Return mock data for development
      return {
        id: `mock_${Date.now()}`,
        conversation_id: callData.conversation_id,
        intent: callData.intent || 'unknown',
        caller_phone: callData.caller_phone,
        timestamp: new Date().toISOString()
      };
    }
  },

  // Get emergency call by conversation ID
  async getByConversationId(conversationId) {
    try {
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
    } catch (error) {
      console.error('Database operation failed:', error);
      return null;
    }
  },

  // Update emergency call
  async update(conversationId, updates) {
    try {
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
    } catch (error) {
      console.error('Database operation failed:', error);
      // Return mock updated data
      return {
        conversation_id: conversationId,
        ...updates,
        timestamp: new Date().toISOString()
      };
    }
  },

  // Get all emergency calls with optional filtering
  async getAll(filters = {}) {
    try {
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
    } catch (error) {
      console.error('Database operation failed:', error);
      // Return mock data for development
      return [];
    }
  }
};