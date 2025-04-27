
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function chunkText(text: string, maxChunkSize: number = 1000): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxChunkSize) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_id, content } = await req.json();
    const mistralApiKey = Deno.env.get('MISTRAL_API_KEY');

    if (!mistralApiKey) {
      throw new Error('Missing Mistral API key');
    }

    // Split the document into chunks
    const chunks = chunkText(content);
    
    // Generate embeddings for each chunk
    const embeddings = await Promise.all(chunks.map(async (chunk) => {
      const response = await fetch('https://api.mistral.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mistralApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-embed',
          input: chunk,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate embedding: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: chunk,
        embedding: data.data[0].embedding,
      };
    }));

    // Store embeddings in the database
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Store all embeddings
    const { error } = await supabaseClient
      .from('document_embeddings')
      .insert(
        embeddings.map(({ content, embedding }) => ({
          document_id,
          content,
          embedding,
        }))
      );

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, chunks: chunks.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing document:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
