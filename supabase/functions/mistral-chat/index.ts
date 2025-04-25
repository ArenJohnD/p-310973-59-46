import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY')!;
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const lastUserMessage = messages[messages.length - 1].content;

    // Generate embedding for the query using Gemini's API
    const embeddingResponse = await fetch("https://api.mistral.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-embed",
        input: lastUserMessage,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error('Failed to generate embedding');
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Perform vector similarity search
    const { data: relevantDocuments, error: searchError } = await supabase
      .rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 5
      });

    if (searchError) {
      console.error('Error searching documents:', searchError);
      throw new Error('Failed to search documents');
    }

    // Format relevant documents for context
    let combinedContext = '';
    if (relevantDocuments && relevantDocuments.length > 0) {
      combinedContext = relevantDocuments
        .map((doc, index) => `[${index + 1}] ${doc.content}\nSimilarity: ${doc.similarity.toFixed(2)}`)
        .join('\n\n');
    }

    // Call Gemini API with context-enhanced prompt
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GEMINI_API_KEY}`
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a helpful AI assistant. Answer questions based on the provided context. 
            If you cannot answer based on the context, say so politely.
            When citing information, use square brackets with numbers to reference specific sources.
            
            Context:
            ${combinedContext || 'No relevant context found.'}
            
            Question: ${lastUserMessage}`
          }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get response from Gemini');
    }

    const data = await response.json();
    
    return new Response(JSON.stringify({
      answer: data.candidates[0].content.parts[0].text,
      context: relevantDocuments || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process your request',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
