
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

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
    const { query, context } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Missing query parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Updated system prompt with enhanced accuracy instructions
    let systemPrompt;
    
    if (context) {
      systemPrompt = `You are NEUPoliSeek, an AI assistant specialized in New Era University policies and procedures. 
      
      VERY IMPORTANT INSTRUCTIONS:
      1. ONLY answer questions related to New Era University policies and procedures.
      2. If a question is not about university policies, politely decline to answer.
      3. Keep your responses PRECISE and FACTUAL. Prioritize accuracy over brevity.
      4. Directly quote from the policy document whenever possible to ensure accuracy.
      5. You MUST ALWAYS cite the EXACT article number and section number for every policy you reference.
      6. ALWAYS format policy references as follows and place them at the END of your response:
         - For articles: **Article X: Title**
         - For sections: **Section Y.Z: Title**
      7. Do not fabricate information if it's not in the context.
      8. If multiple relevant policies exist, mention ALL of them with their citations.
      9. If a policy seems contradictory or unclear, acknowledge this and present the actual text from the document.
      
      Base your response directly and EXCLUSIVELY on the following context from university policy documents:

      ${context}
      
      First provide a factual explanation of the policy using direct quotes where helpful, then cite the specific article and section numbers at the end of your response.
      If the context doesn't address the query directly, briefly state this and suggest where to find more information.`;
    } else {
      systemPrompt = `You are NEUPoliSeek, an AI assistant specialized in New Era University policies and procedures. 
      
      VERY IMPORTANT INSTRUCTIONS:
      1. ONLY answer questions related to New Era University policies and procedures.
      2. If a question is not about university policies, politely decline to answer.
      3. Keep your responses PRECISE and FACTUAL. Prioritize accuracy over brevity.
      4. If you don't have enough information, clearly state this and suggest checking official university resources.
      5. Never guess or provide uncertain information about policies.
      6. If you do have information, ALWAYS cite the specific article number and section number at the END of your response.`;
    }

    console.log("Calling Mistral API with query:", query);
    console.log("Context length:", context ? context.length : 0);
    
    const response = await fetch(MISTRAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: "mistral-large-latest",
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
      console.error("Mistral API error:", responseData);
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
    
    // Return the answer with markdown formatting preserved
    const result = {
      answer: generatedText
    };
    
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in mistral-chat function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
