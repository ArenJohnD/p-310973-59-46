
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

    // Create a more detailed system prompt based on whether we have context or not
    let systemPrompt;
    
    if (context) {
      systemPrompt = `You are NEUPoliSeek, an AI assistant specialized in Northeastern University policies and procedures. 
      Your answers should be helpful, accurate, and based on the provided context from university documents.
      When answering questions, use a formal, professional tone appropriate for an educational institution.
      If you're unsure about a policy, state that clearly rather than providing potentially incorrect information.
      
      IMPORTANT: Base your response directly on the following context from university policy documents:

      ${context}
      
      If the context doesn't address the query directly, acknowledge this and provide the most relevant information from the context, 
      or say you don't have enough information to answer accurately.`;
    } else {
      systemPrompt = `You are NEUPoliSeek, an AI assistant specialized in Northeastern University policies and procedures. 
      Your answers should be helpful, concise, and based only on factual information from the university's official documents.
      When answering questions, use a formal, professional tone appropriate for an educational institution.
      If you're unsure about a policy, state that clearly rather than providing potentially incorrect information.
      If you don't have enough information to answer a specific question, let the user know that they can check official university resources.`;
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
        model: "mistral-large-latest", // Using their most capable model
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
        temperature: 0.2, // Lower temperature for more factual responses
        max_tokens: 800
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
    
    // Find any article and section references in the generated text
    const articleMatch = generatedText.match(/ARTICLE\s+([IVX\d]+)/i);
    const sectionMatch = generatedText.match(/SECTION\s+(\d+(?:\.\d+)?(?:[A-Za-z])?)/i);
    
    const result = {
      answer: generatedText,
      article: articleMatch ? articleMatch[1] : "I",
      section: sectionMatch ? sectionMatch[1] : "1.A"
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
