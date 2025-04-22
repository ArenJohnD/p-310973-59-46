
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, context, documentInfo } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Missing query parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Updated system prompt with citation instructions
    let systemPrompt;
    
    if (context && context.trim().length > 0) {
      systemPrompt = `You are NEUPoliSeek, an AI assistant specialized in New Era University policies and procedures. 
      
      VERY IMPORTANT INSTRUCTIONS:
      1. ONLY answer questions related to New Era University policies and procedures.
      2. If a question is not about university policies, politely decline to answer.
      3. Keep your responses PRECISE and FACTUAL. Prioritize accuracy over brevity.
      4. Directly quote from the policy document whenever possible to ensure accuracy.
      5. You MUST ALWAYS cite the EXACT article number and section number for every policy you reference.
      6. Format citations as [Article X: Title] or [Section Y.Z: Title] at the end of each relevant statement.
      7. For direct quotes, use markdown format: "> quoted text" followed by the citation.
      8. ALWAYS place citations in a consistent format: [Article/Section reference](source-id) where source-id will be replaced with a unique identifier.
      9. Do not fabricate information if it's not in the context.
      10. If multiple relevant policies exist, mention ALL of them with their proper citations.
      11. If a policy seems contradictory or unclear, acknowledge this and present the actual text from the document.
      
      Base your response directly and EXCLUSIVELY on the following context from university policy documents:

      ${context}
      
      First provide a factual explanation of the policy using direct quotes where helpful, then cite the specific article and section numbers using the format described above.
      If the context doesn't address the query directly, briefly state this and suggest where to find more information.`;
    } else {
      systemPrompt = `You are NEUPoliSeek, an AI assistant specialized in New Era University policies and procedures. 
      
      VERY IMPORTANT INSTRUCTIONS:
      1. ONLY answer questions related to New Era University policies and procedures.
      2. If a question is not about university policies, politely decline to answer.
      3. I need the school policy documents to be uploaded first in order to provide you with an accurate response. Once I have the relevant information, I'll be able to assist you with your question. Please upload the necessary documents so I can help you further.
      4. Never guess or provide uncertain information about policies.`;
    }

    console.log("Calling DeepSeek API with query:", query);
    console.log("Context length:", context ? context.length : 0);
    
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat", // Use the appropriate DeepSeek model here
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: query
          }
        ],
        temperature: 0.1, // Very low temperature for factual responses
        max_tokens: 800  // Increased token limit to allow for more detailed responses with quotes
      })
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error("DeepSeek API error:", responseData);
      return new Response(
        JSON.stringify({ error: "Failed to generate response", details: responseData }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const generatedText = responseData.choices[0].message.content;
    console.log("Generated response successfully");
    
    // Process citations from the response
    const processedText = processTextWithCitations(generatedText, documentInfo);
    
    // Return the answer with markdown formatting preserved
    const result = {
      answer: processedText.text,
      citations: processedText.citations
    };
    
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in deepseek-chat function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Process text to extract structured citations
function processTextWithCitations(text: string, documentInfo: any = {}) {
  // Regular expression to match citations in the format [Article X: Title] or [Section Y.Z: Title]
  const citationRegex = /\[(Article|Section)\s+([^:]+):\s*([^\]]+)\]/g;
  
  let citations = [];
  let processedText = text;
  let lastIndex = 0;
  let match;
  
  // Replace citations with hyperlinks
  while ((match = citationRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const type = match[1];
    const number = match[2];
    const title = match[3];
    
    // Create a unique ID for this citation
    const citationId = `citation-${citations.length}`;
    
    // Find document info if available
    let docInfo = null;
    if (documentInfo && documentInfo[`${type.toLowerCase()} ${number}`]) {
      docInfo = documentInfo[`${type.toLowerCase()} ${number}`];
    }
    
    // Create citation object
    const citation = {
      id: citationId,
      reference: `${type} ${number}: ${title}`,
      documentId: docInfo?.documentId || undefined,
      position: docInfo?.position || undefined,
      fileName: docInfo?.fileName || undefined
    };
    
    citations.push(citation);
    
    // Replace citation with linked version
    const replacement = `[${fullMatch}](${citationId})`;
    processedText = processedText.replace(fullMatch, replacement);
  }
  
  return {
    text: processedText,
    citations
  };
}
