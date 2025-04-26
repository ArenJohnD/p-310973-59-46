
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
    const { documentId } = await req.json();

    if (!documentId) {
      throw new Error('Document ID is required');
    }

    // Fetch the document from the database
    const { data: document, error: docError } = await supabase
      .from('reference_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Download file from storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('policy_documents')
      .download(document.file_path);

    if (fileError || !fileData) {
      throw new Error('Failed to download document');
    }

    // Extract text from PDF
    const formData = new FormData();
    formData.append('file', fileData, document.file_name);
    
    const extractResponse = await fetch('https://api.mistral.ai/v1/extract', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mistralApiKey}`,
      },
      body: formData
    });
    
    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      throw new Error(`Failed to extract text: ${errorText}`);
    }
    
    const extractedData = await extractResponse.json();
    const extractedText = extractedData.text;
    
    // Split the text into smaller chunks for embedding
    const chunkSize = 1000;
    const overlap = 200;
    const chunks = [];
    
    for (let i = 0; i < extractedText.length; i += chunkSize - overlap) {
      const chunk = extractedText.substring(i, i + chunkSize);
      if (chunk.trim().length > 0) {
        chunks.push(chunk);
      }
    }
    
    console.log(`Created ${chunks.length} chunks from document`);
    
    // Generate embeddings for each chunk
    const embeddings = [];
    for (const chunk of chunks) {
      const embeddingResponse = await fetch('https://api.mistral.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mistralApiKey}`,
        },
        body: JSON.stringify({
          model: "mistral-embed",
          input: chunk,
        }),
      });
      
      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text();
        throw new Error(`Failed to generate embedding: ${errorText}`);
      }
      
      const embeddingData = await embeddingResponse.json();
      embeddings.push({
        content: chunk,
        embedding: embeddingData.data[0].embedding,
      });
    }
    
    console.log(`Generated ${embeddings.length} embeddings`);
    
    // Store embeddings in the database
    for (const item of embeddings) {
      const { error: insertError } = await supabase
        .from('document_embeddings')
        .insert({
          document_id: documentId,
          content: item.content,
          embedding: item.embedding,
        });
      
      if (insertError) {
        console.error('Error inserting embedding:', insertError);
      }
    }
    
    // Update document as processed
    const { error: updateError } = await supabase
      .from('reference_documents')
      .update({
        processed: true,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', documentId);
    
    if (updateError) {
      throw new Error('Failed to update document status');
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        chunks: chunks.length,
        embeddings: embeddings.length
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
    
  } catch (error) {
    console.error('Error processing document:', error);
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
