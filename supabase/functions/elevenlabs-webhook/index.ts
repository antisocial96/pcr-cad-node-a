/*
  # ElevenLabs Webhook Handler Edge Function

  1. Purpose
    - Receives ElevenLabs post-call webhook events
    - Verifies webhook signature for security
    - Updates garuda_sentry_calls table with call data

  2. Security
    - Validates webhook signature using ELEVENLABS_WEBHOOK_SECRET
    - Uses service role key for database operations
    - Implements CORS headers for cross-origin requests

  3. Functionality
    - Processes post_call_transcription events
    - Extracts intent from webhook analysis data
    - Updates or creates call records in database
*/

import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { createHmac } from 'node:crypto';

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

  const digest = "v0=" + createHmac("sha256", secret).update(message).digest("hex");
  
  if (signature !== digest) {
    return { event: null, error: "Invalid signature" };
  }

  const event = JSON.parse(body);
  return { event, error: null };
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Handle GET requests for health check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ElevenLabs webhook listening" }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  // Handle POST requests (webhook events)
  if (req.method === "POST") {
    try {
      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const webhookSecret = Deno.env.get('ELEVENLABS_WEBHOOK_SECRET');

      if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error('Missing required Supabase environment variables');
      }

      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

      // Verify webhook signature
      const { event, error } = await constructWebhookEvent(req, webhookSecret!);
      
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
      console.log('=== COMPLETE WEBHOOK PAYLOAD ===');
      console.log(JSON.stringify(event, null, 2));
      console.log('=== END PAYLOAD ===');

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
          const { data: existingCall, error: fetchError } = await supabase
            .from('garuda_sentry_calls')
            .select('*')
            .eq('conversation_id', conversationId)
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') {
            throw fetchError;
          }

          if (existingCall) {
            console.log('Found existing call record for conversation:', conversationId);
            
            // Update the call record with webhook data
            const updateData: any = {};
            
            // Extract intent from data.analysis.data_collection_results.intent
            if (webhookData.analysis?.data_collection_results?.intent) {
              updateData.intent = webhookData.analysis.data_collection_results.intent;
            } else {
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

            const { data: updatedCall, error: updateError } = await supabase
              .from('garuda_sentry_calls')
              .update(updateData)
              .eq('conversation_id', conversationId)
              .select();
            
            if (updateError) {
              throw updateError;
            }
            
            console.log('Updated call record with webhook data:', updatedCall[0]);
            
            // Log the extracted intent for debugging
            if (webhookData.analysis?.data_collection_results?.intent) {
              console.log('Extracted intent from webhook:', webhookData.analysis.data_collection_results.intent);
            }
            
            return new Response(
              JSON.stringify({
                received: true,
                success: true, 
                message: 'Webhook processed successfully',
                updated_call: updatedCall[0]
              }),
              {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                  ...corsHeaders,
                },
              }
            );
            
          } else {
            // If call record doesn't exist, create a new one with the real conversation ID
            console.log('Call record not found, creating new record for ElevenLabs conversation:', conversationId);
            
            const newCallData = {
              conversation_id: conversationId,
              intent: webhookData.analysis?.data_collection_results?.intent || 'unknown',
              caller_phone: webhookData.caller_phone || webhookData.phone_number || null,
              timestamp: webhookData.event_timestamp ? new Date(webhookData.event_timestamp).toISOString() : null
            };
            
            const { data: newCall, error: createError } = await supabase
              .from('garuda_sentry_calls')
              .insert([newCallData])
              .select();
            
            if (createError) {
              throw createError;
            }
            
            console.log('Created new call record from webhook with real conversation ID:', newCall[0]);
            
            return new Response(
              JSON.stringify({
                received: true,
                success: true, 
                message: 'New call record created from webhook with real conversation ID',
                created_call: newCall[0]
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
          
        } catch (dbError) {
          console.error('Database error:', dbError);
          return new Response(
            JSON.stringify({
              error: 'Database operation failed',
              details: dbError.message
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
});