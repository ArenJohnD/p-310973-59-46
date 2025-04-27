import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!openrouterApiKey) {
    return new Response(JSON.stringify({
      error: 'OpenRouter API key not configured'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
  try {
    const { messages, context } = await req.json();
    console.log('Received chat request with', messages.length, 'messages');
    // Format the conversation for OpenRouter
    const formattedMessages = messages.map((msg)=>({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));
    // Add system message with context if provided
    if (context) {
      formattedMessages.unshift({
        role: 'system',
        content: `You are Poli, the New Era University Policy Assistant, designed to help users find and understand NEU's policies. \nUse this context to help answer questions: ${context}`
      });
    } else {
      formattedMessages.unshift({
        role: 'system',
        content: 'You are Poli, the New Era University Policy Assistant, designed to help users find and understand NEU\'s policies. Be helpful, clear, and concise. If you don\'t know something, admit it and suggest where they might find the information.'
      });
    }
    console.log('Sending request to OpenRouter API');
    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro-exp-03-25',
        messages: formattedMessages,
        temperature: 0.7
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      throw new Error(`Failed to get response from OpenRouter: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    const answer = data.choices[0].message.content;
    console.log('Received answer from OpenRouter');
    return new Response(JSON.stringify({
      answer,
      context: []
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in mistral-chat function:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});