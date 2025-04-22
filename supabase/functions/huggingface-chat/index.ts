
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2'

const HUGGING_FACE_TOKEN = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN')
const MODEL_ID = "mistralai/Mixtral-8x7B-Instruct-v0.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!HUGGING_FACE_TOKEN) {
      console.error("HUGGING_FACE_ACCESS_TOKEN not configured")
      return new Response(
        JSON.stringify({ 
          answer: "The HuggingFace access token is not configured. Please contact your administrator.",
          citations: []
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Log token for debugging (first few characters only)
    console.log(`Using HuggingFace token starting with: ${HUGGING_FACE_TOKEN.substring(0, 4)}...`)

    const { query, context, documentInfo } = await req.json()

    if (!query) {
      return new Response(
        JSON.stringify({ 
          answer: "Please provide a question to answer.",
          citations: []
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("Query:", query)
    console.log("Context length:", context ? context.length : 0)

    const hf = new HfInference(HUGGING_FACE_TOKEN)

    let systemPrompt
    if (context) {
      systemPrompt = `You are Poli, an AI assistant specializing in New Era University policies and procedures. Base your responses on the following context:

${context}

First provide a concise answer that directly addresses the query. Then support with evidence using direct quotes where helpful. Always cite specific article and section numbers from the source documents.`
    } else {
      systemPrompt = `You are Poli, an AI assistant specialized in New Era University policies and procedures. I don't have specific policy information to reference right now.`
    }

    try {
      const response = await hf.textGeneration({
        model: MODEL_ID,
        inputs: `<s>[INST] ${systemPrompt}

Question: ${query} [/INST]`,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.1,
          top_p: 0.95,
          repetition_penalty: 1.15
        }
      })

      console.log("Generated response successfully")

      // Process citations from the response
      const processedText = processTextWithCitations(response, documentInfo || {})
      
      return new Response(
        JSON.stringify({
          answer: processedText.text,
          citations: processedText.citations
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    } catch (error) {
      console.error("Error calling HuggingFace API:", error)
      return new Response(
        JSON.stringify({ 
          answer: "I encountered an error while processing your question. Please try again later.",
          citations: []
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      )
    }
  } catch (error) {
    console.error("General error:", error)
    return new Response(
      JSON.stringify({ 
        answer: "An unexpected error occurred. Please try again later.",
        citations: []
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    )
  }
})

function processTextWithCitations(text: string, documentInfo: any = {}) {
  const citationRegexes = [
    /\[(Article|Section|Policy)\s+([^:]+?)(?:\s*-\s*|\s*:\s*|\s+)([^\]]+)\]/g,
    /\[([^:]+?):\s+([^\]]+)\]/g,
    /\(([^:]+?):\s+([^)]+)\)/g
  ]

  let citations = []
  let processedText = text

  for (const regex of citationRegexes) {
    let match
    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0]
      let type, number, title

      if (match.length === 4) {
        type = match[1]
        number = match[2].trim()
        title = match[3].trim()
      } else if (match.length === 3) {
        type = "Document"
        number = ""
        title = match[2].trim()
      } else {
        continue
      }

      const citationId = `citation-${citations.length}`

      let docInfo = null
      if (documentInfo) {
        if (type !== "Document" && number && documentInfo[`${type.toLowerCase()} ${number}`]) {
          docInfo = documentInfo[`${type.toLowerCase()} ${number}`]
        } else if (type === "Document" && match[1] && documentInfo[match[1].toLowerCase()]) {
          docInfo = documentInfo[match[1].toLowerCase()]
        }
      }

      const citation = {
        id: citationId,
        reference: type === "Document" ? 
          `${match[1]}: ${title}` : 
          `${type} ${number}: ${title}`,
        documentId: docInfo?.documentId || undefined,
        position: docInfo?.position || undefined,
        fileName: docInfo?.fileName || undefined
      }

      citations.push(citation)

      const replacement = `[${fullMatch}](${citationId})`
      processedText = processedText.replace(fullMatch, replacement)
    }
  }

  return {
    text: processedText,
    citations
  }
}
