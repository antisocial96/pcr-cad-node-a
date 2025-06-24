import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Database operations for emergency calls
export const emergencyCallsDB = {
  // Create a new emergency call record
  async create(callData) {
    const { data, error } = await supabase
      .from('emergency_calls')
      .insert([{
        conversation_id: callData.conversation_id,
        intent: callData.intent || 'unknown',
        caller_phone: callData.caller_phone,
        transcript: callData.transcript,
        priority_level: callData.priority_level || 3,
        status: callData.status || 'pending'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating emergency call:', error);
      throw error;
    }

    return data;
  },

  // Get emergency call by conversation ID
  async getByConversationId(conversationId) {
    const { data, error } = await supabase
      .from('emergency_calls')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching emergency call:', error);
      throw error;
    }

    return data;
  },

  // Update emergency call
  async update(conversationId, updates) {
    const { data, error } = await supabase
      .from('emergency_calls')
      .update(updates)
      .eq('conversation_id', conversationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating emergency call:', error);
      throw error;
    }

    return data;
  },

  // Get all emergency calls with optional filtering
  async getAll(filters = {}) {
    let query = supabase
      .from('emergency_calls')
      .select('*')
      .order('timestamp', { ascending: false });

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.intent) {
      query = query.eq('intent', filters.intent);
    }
    if (filters.priority_level) {
      query = query.eq('priority_level', filters.priority_level);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching emergency calls:', error);
      throw error;
    }

    return data;
  },

  // Get calls by priority (highest first)
  async getByPriority() {
    const { data, error } = await supabase
      .from('emergency_calls')
      .select('*')
      .order('priority_level', { ascending: true })
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching calls by priority:', error);
      throw error;
    }

    return data;
  }
};