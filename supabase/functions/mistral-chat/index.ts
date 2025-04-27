import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!openrouterApiKey) {
    return new Response(
      JSON.stringify({ error: 'OpenRouter API key not configured' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  try {
    const { messages } = await req.json();
    console.log('Received chat request with', messages.length, 'messages');

<<<<<<< HEAD
    // Format the conversation for OpenRouter
    const formattedMessages = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));

    // Add system message with context if provided
    if (context) {
      formattedMessages.unshift({
        role: 'system',
        content: `You are Poli, the NEU Policy Assistant, designed to help users find and understand NEU's policies. \nUse this context to help answer questions: ${context}`
      });
    } else {
      formattedMessages.unshift({
        role: 'system',
        content: 'You are Poli, the NEU Policy Assistant, designed to help users find and understand NEU\'s policies. Be helpful, clear, and concise. If you don\'t know something, admit it and suggest where they might find the information.'
      });
    }

    console.log('Sending request to OpenRouter API');
    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
=======
    // Get the last user message to search for relevant context
    const lastUserMessage = messages.findLast(msg => msg.sender === 'user')?.text || '';

    // Generate embedding for the query
    const embeddingResponse = await fetch('https://api.mistral.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mistralApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-embed',
        input: lastUserMessage,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error('Failed to generate query embedding');
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Search for relevant documents using the embedding
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: relevantDocs, error: searchError } = await supabaseClient.rpc(
      'match_documents',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 5
      }
    );

    if (searchError) throw searchError;

    // Format the conversation for Mistral with document context
    const contextContent = relevantDocs && relevantDocs.length > 0
      ? "Use this context to help answer questions:\n\n" + 
        relevantDocs.map(doc => doc.content).join("\n\n")
      : "If you can't find relevant information in the context, please say so and suggest contacting the administration for more details.";

    const formattedMessages = [
      {
        role: 'system',
        content: `You are Poli, the NEU Policy Assistant. Only provide information based on the context provided. ${contextContent}`
      },
      ...messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }))
    ];

    console.log('Sending request to Mistral API with context');
    
    // Call Mistral API with context
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
>>>>>>> 6f6381cddc5cd3578a7cf85f750d53d63464aa2b
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct:free',
        messages: formattedMessages,
        temperature: 0.7,
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

    return new Response(
      JSON.stringify({ 
        answer,
        context: relevantDocs || []
      }),
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
