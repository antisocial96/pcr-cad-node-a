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
    console.log('🗄️  DATABASE: Creating new call record...');
    console.log('📦 Call data:', JSON.stringify(callData, null, 2));
    
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .insert([callData])
      .select();
    
    if (error) {
      console.error('❌ DATABASE ERROR: Failed to create call record');
      console.error('💥 Error details:', error);
      throw error;
    }
    
    console.log('✅ DATABASE: Successfully created call record');
    console.log('📋 Created record:', JSON.stringify(data[0], null, 2));
    return data[0];
  },

  // Get all calls
  async getAll() {
    console.log('🗄️  DATABASE: Fetching all calls...');
    
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.error('❌ DATABASE ERROR: Failed to fetch all calls');
      console.error('💥 Error details:', error);
      throw error;
    }
    
    console.log(`✅ DATABASE: Successfully fetched ${data.length} calls`);
    return data;
  },

  // Get call by conversation ID
  async getByConversationId(conversationId) {
    console.log('🗄️  DATABASE: Fetching call by conversation ID...');
    console.log('🆔 Conversation ID:', conversationId);
    
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();
    
    if (error) {
      console.error('❌ DATABASE ERROR: Failed to fetch call by conversation ID');
      console.error('🆔 Conversation ID:', conversationId);
      console.error('💥 Error details:', error);
      throw error;
    }
    
    console.log('✅ DATABASE: Successfully found call record');
    console.log('📋 Found record:', JSON.stringify(data, null, 2));
    return data;
  },

  // Update call intent
  async updateIntent(conversationId, intent) {
    console.log('🗄️  DATABASE: Updating call intent...');
    console.log('🆔 Conversation ID:', conversationId);
    console.log('🎯 New intent:', intent);
    
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .update({ intent })
      .eq('conversation_id', conversationId)
      .select();
    
    if (error) {
      console.error('❌ DATABASE ERROR: Failed to update call intent');
      console.error('🆔 Conversation ID:', conversationId);
      console.error('🎯 Intent:', intent);
      console.error('💥 Error details:', error);
      throw error;
    }
    
    console.log('✅ DATABASE: Successfully updated call intent');
    console.log('📋 Updated record:', JSON.stringify(data[0], null, 2));
    return data[0];
  },

  // Update caller phone
  async updateCallerPhone(conversationId, callerPhone) {
    console.log('🗄️  DATABASE: Updating caller phone...');
    console.log('🆔 Conversation ID:', conversationId);
    console.log('📞 New caller phone:', callerPhone);
    
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .update({ caller_phone: callerPhone })
      .eq('conversation_id', conversationId)
      .select();
    
    if (error) {
      console.error('❌ DATABASE ERROR: Failed to update caller phone');
      console.error('🆔 Conversation ID:', conversationId);
      console.error('📞 Caller phone:', callerPhone);
      console.error('💥 Error details:', error);
      throw error;
    }
    
    console.log('✅ DATABASE: Successfully updated caller phone');
    console.log('📋 Updated record:', JSON.stringify(data[0], null, 2));
    return data[0];
  },

  // Get calls by intent
  async getByIntent(intent) {
    console.log('🗄️  DATABASE: Fetching calls by intent...');
    console.log('🎯 Intent:', intent);
    
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .select('*')
      .eq('intent', intent)
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.error('❌ DATABASE ERROR: Failed to fetch calls by intent');
      console.error('🎯 Intent:', intent);
      console.error('💥 Error details:', error);
      throw error;
    }
    
    console.log(`✅ DATABASE: Successfully fetched ${data.length} calls with intent '${intent}'`);
    return data;
  },

  // Update call with webhook data
  async updateFromWebhook(conversationId, webhookData) {
    console.log('🗄️  DATABASE: Updating call with webhook data...');
    console.log('🆔 Conversation ID:', conversationId);
    console.log('📦 Webhook data:', JSON.stringify(webhookData, null, 2));
    
    const updateData = {};
    
    // Map webhook status to intent
    if (webhookData.status) {
      switch (webhookData.status) {
        case 'completed':
          updateData.intent = 'call_completed';
          break;
        case 'failed':
          updateData.intent = 'call_failed';
          break;
        case 'timeout':
          updateData.intent = 'call_timeout';
          break;
        default:
          updateData.intent = webhookData.status;
      }
    }

    // Extract caller phone if available in webhook data
    if (webhookData.caller_phone || webhookData.phone_number) {
      updateData.caller_phone = webhookData.caller_phone || webhookData.phone_number;
    }

    console.log('📝 Mapped update data:', JSON.stringify(updateData, null, 2));
    
    const { data, error } = await supabase
      .from('garuda_sentry_calls')
      .update(updateData)
      .eq('conversation_id', conversationId)
      .select();
    
    if (error) {
      console.error('❌ DATABASE ERROR: Failed to update call from webhook');
      console.error('🆔 Conversation ID:', conversationId);
      console.error('📦 Update data:', JSON.stringify(updateData, null, 2));
      console.error('💥 Error details:', error);
      throw error;
    }
    
    console.log('✅ DATABASE: Successfully updated call from webhook');
    console.log('📋 Updated record:', JSON.stringify(data[0], null, 2));
    return data[0];
  }
};