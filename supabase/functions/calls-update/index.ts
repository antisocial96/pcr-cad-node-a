import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'PUT') {
      const { conversation_id, intent, caller_phone, action } = await req.json();

      if (!conversation_id) {
        return new Response(
          JSON.stringify({ error: 'Missing conversation_id' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            }
          }
        );
      }

      let updateData: any = {};
      
      if (action === 'update_intent' && intent) {
        updateData.intent = intent;
      } else if (action === 'update_phone' && caller_phone) {
        updateData.caller_phone = caller_phone;
      } else {
        return new Response(
          JSON.stringify({ error: 'Invalid action or missing data' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            }
          }
        );
      }

      const { data, error } = await supabase
        .from('garuda_sentry_calls')
        .update(updateData)
        .eq('conversation_id', conversation_id)
        .select();

      if (error) {
        console.error('Error updating call:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update call', details: error.message }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            }
          }
        );
      }

      return new Response(
        JSON.stringify(data[0]),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        }
      }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        }
      }
    );
  }
});