
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

    // Estimate tokens for the conversation history
    let messagesTokens = 0;
    for (const msg of messages) {
      messagesTokens += estimateTokens(msg.content);
    }

    console.log(`Estimated tokens for conversation: ${messagesTokens}`);
    
    // Adjust the available tokens for documents based on conversation size
    const availableTokensForDocs = Math.max(
      MAX_TOTAL_TOKENS - messagesTokens - RESERVE_TOKENS_FOR_MESSAGES, 
      MAX_TOTAL_TOKENS / 2
    ); // Ensure at least half of total tokens are available for docs
    
    console.log(`Available tokens for documents: ${availableTokensForDocs}`);

    // Get content from the documents with strict length limitation
    let documentContentArray = [];
    let totalTokenCount = 0;
    
    // Sort documents by most recently updated first (if available)
    // This is a simple heuristic to prioritize newer content
    documents.sort((a, b) => {
      const aPath = a.file_path.toLowerCase();
      const bPath = b.file_path.toLowerCase();
      // Sort by simple metadata if available
      if (aPath.includes('updated') && !bPath.includes('updated')) return -1;
      if (!aPath.includes('updated') && bPath.includes('updated')) return 1;
      return 0;
    });
    
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
        
        // Roughly estimate token count
        const estimatedTokens = estimateTokens(text);
        
        console.log(`Document ${doc.file_name}: ~${estimatedTokens} tokens`);
        
        // Skip this document entirely if it would exceed our token budget
        if (totalTokenCount + Math.min(estimatedTokens, MAX_TOKENS_PER_DOC) > availableTokensForDocs) {
          console.log(`Skipping document ${doc.file_name} to stay within token budget`);
          continue;
        }
        
        // Split large text into chunks with stricter token limits
        if (estimatedTokens > MAX_TOKENS_PER_DOC) {
          const maxTokensPerChunk = MAX_TOKENS_PER_DOC; 
          const chunkSize = Math.floor(maxTokensPerChunk * 4); // Convert tokens to approximate char count
          
          // Calculate how many chunks we can include based on remaining token budget
          const remainingTokens = availableTokensForDocs - totalTokenCount;
          const maxChunks = Math.floor(remainingTokens / maxTokensPerChunk);
          const chunksToTake = Math.min(3, maxChunks); // Take at most 3 chunks per document
          
          console.log(`Document too large. Taking up to ${chunksToTake} chunks of ~${maxTokensPerChunk} tokens each`);
          
          for (let i = 0; i < chunksToTake && i < Math.ceil(text.length / chunkSize); i++) {
            const chunk = text.substring(i * chunkSize, (i + 1) * chunkSize);
            const chunkWithHeader = `Document: ${doc.file_name} (part ${i + 1})\n${chunk}\n\n`;
            
            documentContentArray.push(chunkWithHeader);
            totalTokenCount += estimateTokens(chunkWithHeader);
            
            if (totalTokenCount >= availableTokensForDocs) {
              break;
            }
          }
        } else {
          // If document fits within our per-doc limit
          const truncatedText = truncateToTokens(text, MAX_TOKENS_PER_DOC);
          const docWithHeader = `Document: ${doc.file_name}\n${truncatedText}\n\n`;
          
          documentContentArray.push(docWithHeader);
          totalTokenCount += estimateTokens(docWithHeader);
        }
        
        // Stop processing more documents if we've reached our token budget
        if (totalTokenCount >= availableTokensForDocs) {
          console.log(`Reached token budget (${totalTokenCount}/${availableTokensForDocs}). Stopping document processing.`);
          break;
        }
        
      } catch (error) {
        console.error(`Error processing document ${doc.file_name}:`, error);
      }
    }

    // Join all document content
    const documentContent = documentContentArray.join("");
    
    console.log(`Sending approximately ${totalTokenCount} tokens of document content to Mistral API`);
    console.log(`Total tokens (docs + conversation): ~${totalTokenCount + messagesTokens + RESERVE_TOKENS_FOR_MESSAGES}`);
    
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
