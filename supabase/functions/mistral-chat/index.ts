
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const mistralApiKey = Deno.env.get('MISTRAL_API_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey || !mistralApiKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { messages, context } = await req.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Invalid messages format');
    }
    
    // Get the last user message for retrieval
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.sender !== 'user') {
      throw new Error('Last message must be from user');
    }
    
    // Generate embeddings for the query
    const embeddingResponse = await fetch('https://api.mistral.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mistralApiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-embed",
        input: lastMessage.text,
      }),
    });
    
    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      throw new Error(`Failed to generate query embedding: ${errorText}`);
    }
    
    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;
    
    // Retrieve relevant documents using the embedding
    const { data: relevantDocs, error: searchError } = await supabase.rpc(
      'match_documents',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.72,
        match_count: 5,
      }
    );
    
    if (searchError) {
      console.error('Error searching for documents:', searchError);
      throw new Error('Failed to retrieve relevant documents');
    }
    
    console.log(`Found ${relevantDocs?.length || 0} relevant document chunks`);
    
    // Create context from retrieved documents
    let retrievedContext = '';
    if (relevantDocs && relevantDocs.length > 0) {
      retrievedContext = "Here is relevant information from our knowledge base:\n\n" + 
        relevantDocs.map((doc, index) => `[Document ${index + 1}]\n${doc.content}`).join('\n\n');
    }
    
    // Format chat messages for the Mistral API
    const mistralMessages = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));
    
    // Create system message with context
    const systemMessage = {
      role: "system",
      content: `You are an AI assistant specializing in NEU university policy information. 
      Answer questions based on the provided context information from our knowledge base. 
      If you don't have relevant information in the context to answer accurately, say so politely.
      ${retrievedContext}`
    };
    
    // Add system message at the beginning
    const fullConversation = [systemMessage, ...mistralMessages];
    
    // Make the completion call to Mistral
    const completionResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${mistralApiKey}`
      },
      body: JSON.stringify({
        model: "mistral-large-latest",
        messages: fullConversation
      })
    });
    
    if (!completionResponse.ok) {
      const errorText = await completionResponse.text();
      throw new Error(`Mistral API error: ${errorText}`);
    }
    
    const completion = await completionResponse.json();
    const answer = completion.choices[0].message.content;
    
    return new Response(
      JSON.stringify({ 
        answer, 
        context: relevantDocs || [] 
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
    
  } catch (error) {
    console.error('Error in mistral-chat function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
