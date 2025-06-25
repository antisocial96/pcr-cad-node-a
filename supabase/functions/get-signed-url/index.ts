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
    // Get environment variables (without VITE_ prefix for Supabase Edge Functions)
    const agentId = Deno.env.get('ELEVENLABS_AGENT_ID');
    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');

    // Check if required environment variables are present
    if (!agentId) {
      console.error("Missing ELEVENLABS_AGENT_ID environment variable");
      return new Response(
        JSON.stringify({ error: "Missing agent ID configuration" }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          }
        }
      );
    }

    if (!apiKey) {
      console.error("Missing ELEVENLABS_API_KEY environment variable");
      return new Response(
        JSON.stringify({ error: "Missing API key configuration" }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          }
        }
      );
    }

    console.log("Making request to ElevenLabs API with agent ID:", agentId);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      {
        headers: {
          "xi-api-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      throw new Error(`ElevenLabs API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.signed_url) {
      console.error("No signed_url in response:", data);
      throw new Error("Invalid response from ElevenLabs API");
    }
    
    return new Response(
      JSON.stringify({ signedUrl: data.signed_url }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        }
      }
    );
  } catch (error) {
    console.error("Error in get-signed-url function:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to generate signed URL",
        details: error.message 
      }),
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