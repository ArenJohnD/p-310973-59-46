
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
          answer: "The DeepSeek API key is not configured. Please contact your administrator to set up the API key in Supabase secrets.",
          citations: []
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
        JSON.stringify({ 
          answer: "There was a problem processing your request. Please try again.",
          citations: [] 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const { query, context, documentInfo, sourceFiles } = reqBody;
    
    // Validate input
    if (!query) {
      console.error("Missing query parameter");
      return new Response(
        JSON.stringify({ 
          answer: "Please provide a question to answer.",
          citations: []
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Query:", query);
    console.log("Context length:", context ? context.length : 0);
    console.log("DocumentInfo provided:", documentInfo ? "Yes" : "No");
    console.log("Source files:", sourceFiles ? sourceFiles.join(', ') : "None specified");
    
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
        
        // Check for exact query matches (highest priority)
        if (pLower.includes(query.toLowerCase())) {
          score += 15;
        }
        
        // Check for individual keyword matches
        queryWords.forEach(word => {
          if (pLower.includes(word)) {
            score += 1;
            
            // Bonus for exact matches or proximity
            const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
            if (wordRegex.test(pLower)) {
              score += 3; // Exact word match bonus
            }
          }
        });
        
        // Check for article/section references (likely important content)
        if (/Article|Section|Policy|Rule/i.test(p)) {
          score *= 1.5;
        }
        
        // Check for rules or requirements (likely answers to policy questions)
        if (/shall|must|required|prohibited|not allowed|mandatory/i.test(p)) {
          score *= 1.3;
        }
        
        return { paragraph: p, score };
      });
      
      // Sort by score and take top results
      scoredParagraphs.sort((a, b) => b.score - a.score);
      
      // Include all high-scoring paragraphs
      const highScoringParagraphs = scoredParagraphs.filter(item => item.score > 5);
      console.log(`Found ${highScoringParagraphs.length} high-scoring paragraphs`);
      
      let truncatedContext = "";
      
      // First include all high-scoring paragraphs
      for (const item of highScoringParagraphs) {
        if (truncatedContext.length + item.paragraph.length < 20000) {
          truncatedContext += item.paragraph + "\n\n";
        } else {
          break;
        }
      }
      
      // If we still have room, add some medium-scoring paragraphs for context
      if (truncatedContext.length < 20000) {
        const mediumScoringParagraphs = scoredParagraphs
          .filter(item => item.score <= 5 && item.score >= 1)
          .slice(0, 20);
          
        for (const item of mediumScoringParagraphs) {
          if (truncatedContext.length + item.paragraph.length < 25000) {
            truncatedContext += item.paragraph + "\n\n";
          } else {
            break;
          }
        }
      }
      
      contextToUse = truncatedContext;
      console.log("Intelligently truncated context length:", contextToUse.length);
    }
    
    if (contextToUse && contextToUse.trim().length > 0) {
      systemPrompt = `You are Poli, an AI assistant specializing in New Era University policies, procedures, and student regulations.
      
      CRITICAL INSTRUCTIONS:
      1. You MUST answer questions about New Era University policies and procedures precisely and accurately.
      2. You are a HELPFUL guide intended to assist students, faculty, and staff in understanding university policies.
      3. Base your responses EXCLUSIVELY on the provided context from university policy documents.
      4. Your responses must be PRECISE, FACTUAL, and DIRECTLY answer the user's question.
      5. ALWAYS cite specific article numbers, section numbers, and document names for every policy you reference.
      6. Format citations as [Article X: Title], [Section Y.Z: Title], or [Document: Title] immediately after each statement.
      7. Use markdown formatting: "**Important point**" for emphasis and "> quoted text" for direct quotes.
      8. NEVER invent or assume information not explicitly stated in the context.
      9. If multiple relevant policies exist, mention ALL of them with proper citations.
      10. If the policy is unclear or seems contradictory, acknowledge this and present the actual text.
      11. If you don't find a specific answer in the context, clearly state so rather than guessing.
      12. Format your response in clear sections with headings when appropriate.
      13. Use bullet points or numbered lists for multi-step procedures or lists of requirements.
      14. Be concise but complete - provide all relevant information to fully answer the question.
      
      Base your response EXCLUSIVELY on these university policy documents:
      
      ${contextToUse}
      
      First provide a concise answer that directly addresses the query. Then support with evidence using direct quotes where helpful. Always cite specific article and section numbers from the source documents.
      
      If the context doesn't fully address the query, acknowledge the limitations and suggest where the user might find more information within the university.`;
    } else {
      systemPrompt = `You are Poli, an AI assistant specialized in New Era University policies and procedures.
      
      I don't have specific policy information in my context right now to answer your question accurately. To best assist you:

      1. I need relevant university policy documents to be uploaded first.
      2. Once documents are available, I can search them and provide you with accurate information.
      3. Please upload documents related to your question so I can assist you better.
      4. I'll never guess about policy information without proper documentation.
      
      If you're looking for general information about university policies, I recommend checking the official New Era University website, student handbook, or contacting the appropriate university department directly.`;
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
      max_tokens: 2000,  // Allow longer responses for comprehensive answers
      top_p: 0.95,       // More deterministic responses
      frequency_penalty: 0.5,  // Reduce repetition
      presence_penalty: 0.5    // Encourage covering different points
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
      // Set a timeout for the fetch operation (30 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); 
      
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
        
        // Handle specific error cases
        if (response.status === 402 || (errorData.error && errorData.error.code === "invalid_request_error" && 
            errorData.error.message && errorData.error.message.includes("Insufficient Balance"))) {
          console.error("DeepSeek API account has insufficient balance");
          return new Response(
            JSON.stringify({ 
              answer: "The AI service is currently unavailable due to account balance issues. Please contact your administrator to recharge the DeepSeek API account.",
              citations: []
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        
        // Return a better error message instead of fallback content
        return new Response(
          JSON.stringify({ 
            answer: "I'm sorry, I'm currently experiencing technical difficulties connecting to my knowledge base. Please try your question again in a few moments.",
            citations: []
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } catch (fetchError) {
      console.error("Fetch error when calling DeepSeek API:", fetchError);
      
      // Handle specific fetch errors
      if (fetchError.name === "AbortError") {
        console.error("Request timed out after 30 seconds");
      }
      
      // Return a better error message
      return new Response(
        JSON.stringify({ 
          answer: "I'm sorry, I'm currently experiencing technical difficulties. Please try your question again in a few moments.",
          citations: []
        }),
        {
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
            answer: "I'm sorry, I received an unexpected response format. Please try your question again.",
            citations: []
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!responseData.choices[0].message || !responseData.choices[0].message.content) {
        console.error("Missing content in DeepSeek API response:", JSON.stringify(responseData.choices[0]));
        return new Response(
          JSON.stringify({ 
            answer: "I apologize, but I couldn't generate a proper response. Please try asking your question again.",
            citations: []
          }),
          {
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
          answer: "I encountered an error while processing my response. Please try your question again.",
          citations: []
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("General error in deepseek-chat function:", error);
    return new Response(
      JSON.stringify({ 
        answer: "An unexpected error occurred. Please try your question again later.",
        citations: []
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Process text to extract structured citations with improved regex matching
function processTextWithCitations(text: string, documentInfo: any = {}) {
  // Enhanced regex to match more citation formats
  const citationRegexes = [
    /\[(Article|Section|Policy)\s+([^:]+?)(?:\s*-\s*|\s*:\s*|\s+)([^\]]+)\]/g,
    /\[([^:]+?):\s+([^\]]+)\]/g,  // Match [Document: Title] format
    /\(([^:]+?):\s+([^)]+)\)/g    // Match (Document: Title) format as well
  ];
  
  let citations = [];
  let processedText = text;
  
  // Process each regex pattern
  for (const regex of citationRegexes) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      let type, number, title;
      
      // Process based on the regex pattern that matched
      if (match.length === 4) {
        // First pattern: [Article|Section|Policy X: Title]
        type = match[1];
        number = match[2].trim();
        title = match[3].trim();
      } else if (match.length === 3) {
        // Second/third pattern: [Document: Title] or (Document: Title)
        type = "Document";
        number = "";
        title = match[2].trim();
      } else {
        continue; // Skip if format doesn't match expectations
      }
      
      // Create a unique ID for this citation
      const citationId = `citation-${citations.length}`;
      
      // Find document info if available
      let docInfo = null;
      if (documentInfo) {
        if (type !== "Document" && number && documentInfo[`${type.toLowerCase()} ${number}`]) {
          docInfo = documentInfo[`${type.toLowerCase()} ${number}`];
        } else if (type === "Document" && match[1] && documentInfo[match[1].toLowerCase()]) {
          docInfo = documentInfo[match[1].toLowerCase()];
        }
      }
      
      // Create citation object
      const citation = {
        id: citationId,
        reference: type === "Document" ? 
          `${match[1]}: ${title}` : 
          `${type} ${number}: ${title}`,
        documentId: docInfo?.documentId || undefined,
        position: docInfo?.position || undefined,
        fileName: docInfo?.fileName || undefined
      };
      
      citations.push(citation);
      
      // Replace citation with linked version
      const replacement = `[${fullMatch}](${citationId})`;
      processedText = processedText.replace(fullMatch, replacement);
    }
  }
  
  return {
    text: processedText,
    citations
  };
}
