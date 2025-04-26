
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const mistralApiKey = Deno.env.get('MISTRAL_API_KEY');
  if (!mistralApiKey) {
    return new Response(
      JSON.stringify({ error: 'Mistral API key not configured' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  try {
    const { messages, context } = await req.json();
    console.log('Received chat request with', messages.length, 'messages');

    // Format the conversation for Mistral
    const formattedMessages = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));

    // Add system message with context if provided
    if (context) {
      formattedMessages.unshift({
        role: 'system',
        content: `You are Poli, the NEU Policy Assistant, designed to help users find and understand NEU's policies. 
                  Use this context to help answer questions: ${context}`
      });
    } else {
      formattedMessages.unshift({
        role: 'system',
        content: 'You are Poli, the NEU Policy Assistant, designed to help users find and understand NEU\'s policies. Be helpful, clear, and concise. If you don\'t know something, admit it and suggest where they might find the information.'
      });
    }

    console.log('Sending request to Mistral API');
    
    // Call Mistral API
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mistralApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-medium',
        messages: formattedMessages,
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mistral API error:', response.status, errorText);
      throw new Error(`Failed to get response from Mistral: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;
    console.log('Received answer from Mistral');

    return new Response(
      JSON.stringify({ answer, context: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in mistral-chat function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
