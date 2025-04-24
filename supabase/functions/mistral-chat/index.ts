
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    
    // Create a Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Fetch all reference documents
    const { data: documents, error: docError } = await supabase
      .from('reference_documents')
      .select('id, file_name, file_path');
    
    if (docError) {
      console.error('Error fetching reference documents:', docError);
      throw new Error('Failed to retrieve reference documents');
    }

    // If no reference documents found
    if (!documents || documents.length === 0) {
      return new Response(JSON.stringify({
        answer: "I don't have any reference documents to answer from. Please ask an administrator to upload relevant documents."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get content from the documents
    let documentContent = "";
    for (const doc of documents) {
      try {
        // Create a signed URL for the document
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('policy_documents')
          .createSignedUrl(doc.file_path, 60); // 60 seconds expiry
        
        if (signedUrlError || !signedUrlData) {
          console.error(`Error creating signed URL for ${doc.file_name}:`, signedUrlError);
          continue;
        }

        // Extract text from PDF (simplified approach - in production you'd want to use a proper PDF parser)
        const response = await fetch(signedUrlData.signedUrl);
        if (!response.ok) {
          console.error(`Error fetching document ${doc.file_name}:`, response.statusText);
          continue;
        }
        
        // For simple text extraction we're just converting to text
        // In a production environment, you'd want to use a proper PDF extraction library
        const text = await response.text();
        
        // Add document identifier and content
        documentContent += `Document: ${doc.file_name}\n${text}\n\n`;
      } catch (error) {
        console.error(`Error processing document ${doc.file_name}:`, error);
      }
    }

    // Prepare system message with instructions to only use reference documents
    const systemMessage = {
      role: "system", 
      content: `You are an AI assistant that ONLY answers questions based on the reference documents provided. 
      If a question cannot be answered using the reference documents, politely explain that you don't have that information.
      Never make up information or use external knowledge.
      
      Reference Documents:
      ${documentContent}`
    };
    
    // Add system message to the beginning of messages array
    const augmentedMessages = [systemMessage, ...messages];

    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "mistral-tiny",
        messages: augmentedMessages,
        temperature: 0.7,
        max_tokens: 1000,
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
