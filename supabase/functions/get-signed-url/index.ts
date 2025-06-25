/*
  # ElevenLabs Signed URL Generator Edge Function

  1. Purpose
    - Generates signed URLs for ElevenLabs conversation sessions
    - Provides secure access to ElevenLabs ConvAI API

  2. Security
    - Uses ELEVENLABS_API_KEY from environment variables
    - Implements CORS headers for cross-origin requests

  3. Functionality
    - Fetches signed URL from ElevenLabs API
    - Returns URL for frontend to establish WebSocket connection
*/

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

  // Handle GET requests
  if (req.method === "GET") {
    try {
      const agentId = Deno.env.get('ELEVENLABS_AGENT_ID');
      const apiKey = Deno.env.get('ELEVENLABS_API_KEY');

      if (!agentId || !apiKey) {
        throw new Error('Missing ElevenLabs configuration');
      }

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
        {
          headers: {
            "xi-api-key": apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get signed URL from ElevenLabs");
      }

      const data = await response.json();
      
      return new Response(
        JSON.stringify({ signedUrl: data.signed_url }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    } catch (error) {
      console.error("Error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to generate signed URL" }),
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