import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing required Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export const garudaSentryCalls = {
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