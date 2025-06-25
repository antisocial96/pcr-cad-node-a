// index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, elevenlabs-signature",
  "Content-Type": "application/json"
};
// Dev Mode Check
// const isDevMode = Deno.env.get("DEV_MODE") === "true";
const constructWebhookEvent = async (req, secret)=>{
  const body = await req.text();
  const signatureHeader = req.headers.get('elevenlabs-signature');
  if (!signatureHeader) return {
    event: null,
    error: "Missing signature header"
  };
  const headers = signatureHeader.split(",");
  const timestamp = headers.find((e)=>e.startsWith("t="))?.substring(2);
  const signature = headers.find((e)=>e.startsWith("v0="));
  if (!timestamp || !signature) return {
    event: null,
    error: "Invalid signature format"
  };
  const reqTimestamp = Number(timestamp) * 1000;
  const tolerance = Date.now() - 30 * 60 * 1000;
  if (reqTimestamp < tolerance) return {
    event: null,
    error: "Request expired"
  };
  const message = `${timestamp}.${body}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  try {
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, {
      name: 'HMAC',
      hash: 'SHA-256'
    }, false, [
      'sign'
    ]);
    const signatureBytes = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureHex = "v0=" + Array.from(new Uint8Array(signatureBytes)).map((b)=>b.toString(16).padStart(2, '0')).join('');
    if (signature !== signatureHex) return {
      event: null,
      error: "Invalid signature"
    };
    const event = JSON.parse(body);
    return {
      event,
      error: null
    };
  } catch (err) {
    return {
      event: null,
      error: `Signature verification failed: ${err.message}`
    };
  }
};
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
  if (req.method === "GET") return new Response(JSON.stringify({
    status: "ElevenLabs webhook listening"
  }), {
    headers: corsHeaders
  });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: corsHeaders
    });
  }
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ELEVENLABS_WEBHOOK_SECRET = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ELEVENLABS_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({
      error: "Missing environment variables"
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  // Signature check bypass
  /*const { event, error } = isDevMode ? await (async ()=>{
    const rawBody = await req.text();
    try {
      const event = JSON.parse(rawBody);
      return {
        event,
        error: null
      };
    } catch (parseError) {
      return {
        event: null,
        error: 'Invalid JSON in dev mode'
      };
    }
  })() : await constructWebhookEvent(req, DEV_MODE); */ const { event, error } = await constructWebhookEvent(req, ELEVENLABS_WEBHOOK_SECRET);
  if (error) return new Response(JSON.stringify({
    error
  }), {
    status: 401,
    headers: corsHeaders
  });
  if (event?.type === "post_call_transcription") {
    const data = event.data;
    const conversationId = data.conversation_id;
    if (!conversationId) return new Response(JSON.stringify({
      error: "Missing conversation_id"
    }), {
      status: 400,
      headers: corsHeaders
    });
    const intent = data.analysis?.data_collection_results?.intent || 'unknown';
    const caller_phone = data.caller_phone || data.phone_number || null;
    const timestamp = data.event_timestamp ? new Date(data.event_timestamp).toISOString() : null;
    try {
      const { data: existingCall, error: findErr } = await supabase.from("garuda_sentry_calls").select("*").eq("conversation_id", conversationId).single();
      if (existingCall) {
        const { data: updated, error: updateErr } = await supabase.from("garuda_sentry_calls").update({
          intent,
          caller_phone,
          timestamp
        }).eq("conversation_id", conversationId).select();
        if (updateErr) throw updateErr;
        return new Response(JSON.stringify({
          received: true,
          updated_call: updated[0]
        }), {
          status: 200,
          headers: corsHeaders
        });
      } else {
        const { data: created, error: insertErr } = await supabase.from("garuda_sentry_calls").insert([
          {
            conversation_id: conversationId,
            intent,
            caller_phone,
            timestamp
          }
        ]).select();
        if (insertErr) throw insertErr;
        return new Response(JSON.stringify({
          received: true,
          created_call: created[0]
        }), {
          status: 200,
          headers: corsHeaders
        });
      }
    } catch (dbErr) {
      return new Response(JSON.stringify({
        error: dbErr.message
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
  return new Response(JSON.stringify({
    received: true,
    type: event?.type
  }), {
    status: 200,
    headers: corsHeaders
  });
});
