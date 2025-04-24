
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

// Constants for token management
const MAX_TOKENS_PER_DOC = 8000; // Approximate max tokens per document
const MAX_TOTAL_TOKENS = 20000; // Maximum total tokens to send to Mistral
const MAX_RESPONSE_TOKENS = 1000; // Maximum tokens for response

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

    // Get content from the documents with length limitation
    let documentContentArray = [];
    let totalTokenCount = 0;
    
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

        // Extract text from PDF
        const response = await fetch(signedUrlData.signedUrl);
        if (!response.ok) {
          console.error(`Error fetching document ${doc.file_name}:`, response.statusText);
          continue;
        }
        
        // For simple text extraction we're just converting to text
        const text = await response.text();
        
        // Roughly estimate token count (approximation: ~4 chars per token)
        const estimatedTokens = Math.ceil(text.length / 4);
        
        // Split large text into chunks if needed
        if (estimatedTokens > MAX_TOKENS_PER_DOC) {
          // Simple chunking based on character count
          const chunkSize = Math.floor(MAX_TOKENS_PER_DOC * 4); // Convert tokens to approximate char count
          for (let i = 0; i < text.length; i += chunkSize) {
            const chunk = text.substring(i, i + chunkSize);
            
            // Only add chunk if we haven't exceeded our total token budget
            if ((totalTokenCount + Math.ceil(chunk.length / 4)) <= MAX_TOTAL_TOKENS) {
              documentContentArray.push(`Document: ${doc.file_name} (part ${Math.floor(i/chunkSize) + 1})\n${chunk}\n\n`);
              totalTokenCount += Math.ceil(chunk.length / 4);
            } else {
              break; // Stop adding more chunks if we've reached token limit
            }
          }
        } else {
          // If document is small enough, add the whole document
          if ((totalTokenCount + estimatedTokens) <= MAX_TOTAL_TOKENS) {
            documentContentArray.push(`Document: ${doc.file_name}\n${text}\n\n`);
            totalTokenCount += estimatedTokens;
          }
        }
        
        // Stop processing more documents if we've reached our token budget
        if (totalTokenCount >= MAX_TOTAL_TOKENS) {
          break;
        }
        
      } catch (error) {
        console.error(`Error processing document ${doc.file_name}:`, error);
      }
    }

    // Join all document content
    const documentContent = documentContentArray.join("");
    
    console.log(`Sending approximately ${totalTokenCount} tokens to Mistral API`);
    
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

    // Make request to Mistral API
    try {
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
        
        // Handle token limit error specifically
        if (error.message && error.message.includes("too large for model")) {
          return new Response(JSON.stringify({
            answer: "I'm sorry, but there are too many reference documents for me to process at once. Please ask your administrator to optimize the document storage or ask a more specific question that might require fewer documents."
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        throw new Error('Failed to get response from Mistral');
      }

      const data = await response.json();
      
      return new Response(JSON.stringify({
        answer: data.choices[0].message.content,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error calling Mistral API:', error);
      throw error;
    }

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
