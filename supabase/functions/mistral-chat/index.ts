
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY')!;
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants for token management - more restrictive limits
const MAX_TOKENS_PER_DOC = 3000; // Reduced from 8000
const MAX_TOTAL_TOKENS = 12000; // Reduced from 20000
const MAX_RESPONSE_TOKENS = 1000; // Keep same response token limit
const RESERVE_TOKENS_FOR_MESSAGES = 4000; // Reserve tokens for conversation history

// Simple function to estimate tokens (roughly 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Function to truncate text to a target token count
function truncateToTokens(text: string, maxTokens: number): string {
  const estimatedTokensPerChar = 0.25; // ~4 chars per token
  const estimatedChars = maxTokens / estimatedTokensPerChar;
  if (text.length > estimatedChars) {
    return text.substring(0, Math.floor(estimatedChars)) + "...";
  }
  return text;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Get the last user message for similarity search
    const lastUserMessage = messages[messages.length - 1].content;
    
    // Generate embedding for the query using Mistral's API
    const embeddingResponse = await fetch("https://api.mistral.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-embed",
        input: lastUserMessage,
      }),
    });

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

    // Prepare context from relevant documents
    const context = relevantDocuments
      ? relevantDocuments
          .map(doc => doc.content)
          .join('\n\n')
      : '';

    // Create system message with context
    const systemMessage = {
      role: "system",
      content: `You are a helpful assistant that answers questions based on the provided context. 
      If a question cannot be answered using the context, politely explain that you don't have that information.
      Never make up information or use knowledge outside of the provided context.
      
      Context:
      ${context}`
    };

    // Add system message to the beginning of messages array
    const augmentedMessages = [systemMessage, ...messages];

    // Make request to Mistral API with context-enhanced messages
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "mistral-small",
        messages: augmentedMessages,
        temperature: 0.7,
        max_tokens: MAX_RESPONSE_TOKENS,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Mistral API error:', error);
      throw new Error('Failed to get response from Mistral');
    }

    const data = await response.json();
    
    return new Response(JSON.stringify({
      answer: data.choices[0].message.content,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in mistral-chat function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process your request' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
