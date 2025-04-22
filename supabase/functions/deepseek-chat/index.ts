
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
  console.log("DeepSeek function called with method:", req.method);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Check API key first
    if (!DEEPSEEK_API_KEY) {
      console.error("DEEPSEEK_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          error: "API key not configured",
          message: "The DeepSeek API key is missing. Please check your Supabase secrets configuration."
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Log API key first few characters to verify it exists (don't log the actual key)
    const apiKeyStart = DEEPSEEK_API_KEY.substring(0, 5) + "...";
    console.log("API key format check:", apiKeyStart, "length:", DEEPSEEK_API_KEY.length);
    
    // Parse request body with error handling
    let reqBody;
    try {
      reqBody = await req.json();
    } catch (e) {
      console.error("Failed to parse request JSON:", e.message);
      return new Response(
        JSON.stringify({ error: "Invalid request format", details: e.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const { query, context, documentInfo } = reqBody;
    
    // Validate input
    if (!query) {
      console.error("Missing query parameter");
      return new Response(
        JSON.stringify({ error: "Missing query parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Query:", query);
    console.log("Context length:", context ? context.length : 0);
    console.log("DocumentInfo provided:", documentInfo ? "Yes" : "No");
    
    // System prompt with clear instructions
    let systemPrompt;
    let contextToUse = context;
    
    // Manage context size more effectively
    if (context && context.length > 25000) {
      console.warn("Context is very large, intelligently truncating");
      // Split by paragraphs and prioritize content with query keywords
      const paragraphs = context.split(/\n\s*\n/);
      const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      
      // Score paragraphs by relevance to query
      const scoredParagraphs = paragraphs.map(p => {
        let score = 0;
        const pLower = p.toLowerCase();
        
        queryWords.forEach(word => {
          if (pLower.includes(word)) {
            score += 1;
            // Bonus for exact matches or proximity
            if (pLower.includes(query.toLowerCase())) {
              score += 5;
            }
          }
        });
        
        // Bonus for structured content (likely more important)
        if (p.match(/Article|Section|Policy/i)) {
          score *= 1.5;
        }
        
        return { paragraph: p, score };
      });
      
      // Sort by score and take top results
      scoredParagraphs.sort((a, b) => b.score - a.score);
      
      let truncatedContext = "";
      for (const item of scoredParagraphs) {
        if (truncatedContext.length + item.paragraph.length < 25000) {
          truncatedContext += item.paragraph + "\n\n";
        } else {
          break;
        }
      }
      
      contextToUse = truncatedContext;
      console.log("Intelligently truncated context length:", contextToUse.length);
    }
    
    if (contextToUse && contextToUse.trim().length > 0) {
      systemPrompt = `You are NEUPoliSeek, an AI assistant specialized in New Era University policies and procedures.
      
      CRITICAL INSTRUCTIONS:
      1. You MUST answer ONLY questions about New Era University policies and procedures.
      2. If a question is not about university policies, politely explain you can only help with policy questions.
      3. Your responses must be PRECISE, FACTUAL, and based ONLY on the provided context.
      4. ALWAYS quote directly from the policy documents when possible, using exact wording.
      5. You MUST cite the EXACT article number and section number for every policy you reference.
      6. Format citations as [Article X: Title] or [Section Y.Z: Title] immediately after each statement.
      7. Use markdown for direct quotes: "> quoted text" with the citation right after.
      8. NEVER invent or assume information not explicitly stated in the context.
      9. If multiple relevant policies exist, mention ALL of them with proper citations.
      10. If the policy is unclear or seems contradictory, acknowledge this and present the actual text.
      11. If you don't find a specific answer in the context, say so clearly rather than guessing.
      12. Format your response in clear sections with headings when appropriate.
      
      Base your response EXCLUSIVELY on these university policy documents:
      
      ${contextToUse}
      
      First provide a concise answer focused directly on the query. Then support with evidence using direct quotes where helpful. Always cite specific article and section numbers.
      If the context doesn't fully address the query, acknowledge the limitations and suggest where the user might find more information.`;
    } else {
      systemPrompt = `You are NEUPoliSeek, an AI assistant specialized in New Era University policies and procedures.
      
      I don't have specific policy information in my context right now. To answer your question accurately:

      1. I need relevant university policy documents to be uploaded first.
      2. Once documents are available, I can search them and provide you with accurate information.
      3. Please upload documents related to your question so I can assist you better.
      4. I'll never guess about policy information without proper documentation.`;
    }
    
    // Log context details for debugging
    if (contextToUse) {
      console.log("Context sample (first 100 chars):", contextToUse.substring(0, 100));
      console.log("Context sections:", contextToUse.split(/\n\s*\n/).length);
    }
    
    // Prepare the request payload with reduced temperature for more factual responses
    const payload = {
      model: "deepseek-chat",
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
      temperature: 0.1,  // Very low temperature for more factual responses
      max_tokens: 1000,  // Allow longer responses for comprehensive answers
      top_p: 0.95        // More deterministic responses
    };
    
    console.log("Request payload structure:", JSON.stringify({
      model: payload.model,
      messages: [
        { role: "system", content: "SYSTEM PROMPT (length: " + systemPrompt.length + ")" },
        { role: "user", content: "QUERY (length: " + query.length + ")" }
      ],
      temperature: payload.temperature,
      max_tokens: payload.max_tokens,
      top_p: payload.top_p
    }));
    
    // Make the API call with detailed error handling and timeout
    console.log("Sending request to DeepSeek API...");
    
    let response;
    try {
      // Set a timeout for the fetch operation (20 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); 
      
      response = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log("Response status:", response.status);
      
      // Check for API error responses
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`DeepSeek API error (${response.status}):`, errorText);
        
        // Try to parse the error as JSON
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { raw: errorText };
        }
        
        // Provide a fallback response when DeepSeek API fails
        if (contextToUse && contextToUse.length > 0) {
          console.log("Providing fallback response from context");
          
          // Find most relevant section to provide as fallback
          const contextParagraphs = contextToUse.split(/\n\s*\n/);
          let bestMatch = "";
          let bestScore = 0;
          
          const queryWords = query.toLowerCase().split(/\s+/);
          
          for (const paragraph of contextParagraphs) {
            if (paragraph.trim().length < 50) continue; // Skip very short paragraphs
            
            const paragraphLower = paragraph.toLowerCase();
            let score = 0;
            
            for (const word of queryWords) {
              if (word.length > 3 && paragraphLower.includes(word)) {
                score += 1;
              }
            }
            
            if (score > bestScore) {
              bestScore = score;
              bestMatch = paragraph;
            }
          }
          
          if (bestScore > 0) {
            return new Response(
              JSON.stringify({ 
                answer: `I found this information that might be relevant to your question:\n\n${bestMatch}\n\n(Note: The DeepSeek API was unavailable, so I'm showing the most relevant section from the documents. For more specific answers, please try again later.)`,
                citations: []
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }
        
        return new Response(
          JSON.stringify({ 
            error: `DeepSeek API returned status ${response.status}`, 
            details: errorData,
            message: "There was an issue with the DeepSeek API. Please try again later."
          }),
          {
            status: 502, // Using 502 Bad Gateway for API failures
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } catch (fetchError) {
      console.error("Fetch error when calling DeepSeek API:", fetchError);
      
      // Handle specific fetch errors
      if (fetchError.name === "AbortError") {
        console.error("Request timed out after 20 seconds");
        return new Response(
          JSON.stringify({ 
            error: "Request to DeepSeek API timed out",
            details: "The request took too long to complete",
            message: "The DeepSeek API is taking too long to respond. Please try again later."
          }),
          {
            status: 504, // Gateway Timeout
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: "Error connecting to DeepSeek API",
          details: fetchError.message,
          message: "There was an error connecting to the DeepSeek API. Please try again later."
        }),
        {
          status: 503, // Service Unavailable
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Process successful response with robust error handling
    let responseData;
    try {
      responseData = await response.json();
      console.log("DeepSeek API successful response received");
      console.log("Response structure:", Object.keys(responseData).join(", "));
      
      if (!responseData.choices || responseData.choices.length === 0) {
        console.error("Invalid response format from DeepSeek API:", JSON.stringify(responseData).substring(0, 200) + "...");
        return new Response(
          JSON.stringify({ 
            error: "Invalid response format from DeepSeek API",
            details: "No choices in response",
            message: "The DeepSeek API returned an unexpected response format. Please try again later."
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!responseData.choices[0].message || !responseData.choices[0].message.content) {
        console.error("Missing content in DeepSeek API response:", JSON.stringify(responseData.choices[0]));
        return new Response(
          JSON.stringify({ 
            error: "Invalid content in DeepSeek API response",
            details: responseData.choices[0],
            message: "The DeepSeek API returned a response with missing content. Please try again later."
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      const generatedText = responseData.choices[0].message.content;
      console.log("Generated response successfully, length:", generatedText.length);
      console.log("Response sample:", generatedText.substring(0, 100) + "...");
      
      // Process citations from the response
      const processedText = processTextWithCitations(generatedText, documentInfo || {});
      console.log("Extracted citations count:", processedText.citations.length);
      
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
    } catch (parseError) {
      console.error("Error parsing DeepSeek API response:", parseError);
      let rawResponse = "";
      try {
        rawResponse = await response.text().catch(() => "Unable to get raw text");
        console.error("Raw response text (first 200 chars):", rawResponse.substring(0, 200));
      } catch (e) {
        console.error("Could not get raw response text");
      }
      
      return new Response(
        JSON.stringify({ 
          error: "Error parsing DeepSeek API response",
          details: parseError.message,
          message: "There was an error processing the response from the DeepSeek API. Please try again later."
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("General error in deepseek-chat function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        message: "An unexpected error occurred. Please try again later."
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Process text to extract structured citations with improved regex matching
function processTextWithCitations(text: string, documentInfo: any = {}) {
  // Enhanced regex to match more citation formats
  const citationRegex = /\[(Article|Section|Policy)\s+([^:]+?)(?:\s*-\s*|\s*:\s*|\s+)([^\]]+)\]/g;
  
  let citations = [];
  let processedText = text;
  let match;
  
  // Replace citations with hyperlinks
  while ((match = citationRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const type = match[1];
    const number = match[2].trim();
    const title = match[3].trim();
    
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
