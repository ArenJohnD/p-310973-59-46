
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

    // Enhanced system prompt with brevity instruction and formatting guidance
    let systemPrompt;
    
    if (context) {
      systemPrompt = `You are NEUPoliSeek, an AI assistant specialized in New Era University policies and procedures. 
      
      VERY IMPORTANT INSTRUCTIONS:
      1. ONLY answer questions related to New Era University policies and procedures.
      2. If a question is not about university policies, politely decline to answer.
      3. Keep your responses BRIEF and CONCISE. Use no more than 3-4 sentences when possible.
      4. ALWAYS format policy references in bold, like this: **Article X, Section Y**.
      5. When referring to specific policies, use italic for important terms or keywords.
      6. Do not fabricate information if it's not in the context.
      
      Base your response directly on the following context from university policy documents:

      ${context}
      
      Extract and highlight specific article numbers, section numbers, and policy titles.
      When mentioning them, format as: **Article X: Title** or **Section Y.Z: Title**.
      If the context doesn't address the query directly, briefly state this and suggest where to find more information.`;
    } else {
      systemPrompt = `You are NEUPoliSeek, an AI assistant specialized in New Era University policies and procedures. 
      
      VERY IMPORTANT INSTRUCTIONS:
      1. ONLY answer questions related to New Era University policies and procedures.
      2. If a question is not about university policies, politely decline to answer.
      3. Keep your responses BRIEF and CONCISE. Use no more than 3-4 sentences when possible.
      4. If you don't have enough information, briefly state this and suggest checking official university resources.`;
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
        temperature: 0.1, // Lower temperature for more predictable responses
        max_tokens: 500  // Reduced token limit to encourage brevity
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
