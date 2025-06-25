/*
  # ElevenLabs Post-Call Webhook Edge Function

  1. New Edge Function
    - `elevenlabs-webhook`
      - Handles ElevenLabs post-call webhook events
      - Verifies webhook signatures for security
      - Processes post_call_transcription events
      - Updates or creates call records in garuda_sentry_calls table

  2. Security
    - Webhook signature verification using HMAC SHA256
    - 30-minute timestamp tolerance for replay attack prevention
    - Service role access for database operations

  3. Features
    - Complete webhook payload logging for debugging
    - Automatic call record creation/update
    - Intent extraction from webhook analysis data
    - Caller phone number extraction
    - Proper error handling and response codes
*/

import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, elevenlabs-signature",
};

// Helper function to construct and verify webhook event
const constructWebhookEvent = async (req: Request, secret: string) => {
  const body = await req.text();
  const signature_header = req.headers.get('elevenlabs-signature');
  
  if (!signature_header) {
    return { event: null, error: "Missing signature header" };
  }

  const headers = signature_header.split(",");
  const timestamp = headers.find((e) => e.startsWith("t="))?.substring(2);
  const signature = headers.find((e) => e.startsWith("v0="));

  if (!timestamp || !signature) {
    return { event: null, error: "Invalid signature format" };
  }

  // Validate timestamp (30 minute tolerance)
  const reqTimestamp = Number(timestamp) * 1000;
  const tolerance = Date.now() - 30 * 60 * 1000;
  if (reqTimestamp < tolerance) {
    return { event: null, error: "Request expired" };
  }

  // Validate hash
  const message = `${timestamp}.${body}`;

  if (!secret) {
    return { event: null, error: "Webhook secret not configured" };
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature_bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const digest = "v0=" + Array.from(new Uint8Array(signature_bytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  if (signature !== digest) {
    return { event: null, error: "Invalid signature" };
  }

  const event = JSON.parse(body);
  return { event, error: null };
};

// Database operations for garuda_sentry_calls table
const createGarudaSentryCallsOperations = (supabase: any) => ({
  // Create a new call record
  async create(callData: any) {
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

  // Get call by conversation ID
  async getByConversationId(conversationId: string) {
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

  // Update call with webhook data
  async updateFromWebhook(conversationId: string, webhookData: any) {
    const updateData: any = {};
    
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
});

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const garudaSentryCalls = createGarudaSentryCallsOperations(supabase);

    // Handle GET request for webhook status
    if (req.method === "GET") {
      return new Response(
        JSON.stringify({ status: "webhook listening" }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Handle POST request for webhook events
    if (req.method === "POST") {
      const secret = Deno.env.get('ELEVENLABS_WEBHOOK_SECRET');
      
      if (!secret) {
        console.error('ELEVENLABS_WEBHOOK_SECRET not configured');
        return new Response(
          JSON.stringify({ error: 'Webhook secret not configured' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      const { event, error } = await constructWebhookEvent(req, secret);
      
      if (error) {
        console.error('Webhook verification failed:', error);
        return new Response(
          JSON.stringify({ error: error }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      // Store and log the entire JSON payload for debugging
      const completePayload = event;
      console.log('=== COMPLETE WEBHOOK PAYLOAD ===');
      console.log(JSON.stringify(completePayload, null, 2));
      console.log('=== END PAYLOAD ===');

      console.log('Verified ElevenLabs post-call webhook:', JSON.stringify(event, null, 2));
      
      // Handle post_call_transcription event
      if (event.type === "post_call_transcription") {
        console.log("Post-call transcription event data:", JSON.stringify(event.data, null, 2));
        
        const webhookData = event.data;
        
        // Extract conversation_id from data.conversation_id
        const conversationId = webhookData.conversation_id;
        
        if (!conversationId) {
          console.error('No conversation_id found in webhook payload');
          return new Response(
            JSON.stringify({ error: 'Missing conversation_id in webhook payload' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
              },
            }
          );
        }
        
        console.log('Processing webhook for conversation ID:', conversationId);
        
        // Check if the call record exists
        try {
          const existingCall = await garudaSentryCalls.getByConversationId(conversationId);
          console.log('Found existing call record for conversation:', conversationId);
          
          // Update the call record with webhook data
          const updatedCall = await garudaSentryCalls.updateFromWebhook(conversationId, webhookData);
          console.log('Updated call record with webhook data:', updatedCall);
          
          // Log the extracted intent for debugging
          if (webhookData.analysis?.data_collection_results?.intent) {
            console.log('Extracted intent from webhook:', webhookData.analysis.data_collection_results.intent);
          }
          
          return new Response(
            JSON.stringify({ 
              received: true,
              success: true, 
              message: 'Webhook processed successfully',
              updated_call: updatedCall
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
              },
            }
          );
          
        } catch (fetchError) {
          // If call record doesn't exist, create a new one with the real conversation ID
          console.log('Call record not found, creating new record for ElevenLabs conversation:', conversationId);
          
          const newCallData = {
            conversation_id: conversationId,
            intent: webhookData.analysis?.data_collection_results?.intent || 'unknown',
            caller_phone: webhookData.caller_phone || webhookData.phone_number || null,
            timestamp: webhookData.event_timestamp ? new Date(webhookData.event_timestamp).toISOString() : null
          };
          
          const newCall = await garudaSentryCalls.create(newCallData);
          console.log('Created new call record from webhook with real conversation ID:', newCall);
          
          return new Response(
            JSON.stringify({ 
              received: true,
              success: true, 
              message: 'New call record created from webhook with real conversation ID',
              created_call: newCall
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
              },
            }
          );
        }
      }
      
      // For other event types, just acknowledge receipt
      console.log('Received webhook event type:', event.type);
      return new Response(
        JSON.stringify({ received: true }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
    
  } catch (error) {
    console.error('Error processing ElevenLabs webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process webhook',
        details: error.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});