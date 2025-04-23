import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
const GROQ_MODEL = "llama3-70b-8192" // Currently supported model
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

// Maximum context size to prevent token limit errors
const MAX_CONTEXT_SIZE = 4000 

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!GROQ_API_KEY) {
      console.error("GROQ_API_KEY not configured")
      return new Response(
        JSON.stringify({ 
          answer: "The Groq API key is not configured. Please contact your administrator.",
          citations: []
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log(`Using Groq API key starting with: ${GROQ_API_KEY.substring(0, 4)}...`)

    const { query, context, documentInfo, sourceFiles } = await req.json()

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
    console.log("Source files:", sourceFiles || "none specified")

    // Truncate context if it's too long
    let truncatedContext = context
    if (context && context.length > MAX_CONTEXT_SIZE) {
      console.log(`Context too long (${context.length}), truncating to ${MAX_CONTEXT_SIZE} characters`)
      truncatedContext = context.substring(0, MAX_CONTEXT_SIZE) + 
        "\n\n[Note: Some context was truncated due to length limitations. Please provide a more specific query for better results.]"
    }

    // Build system prompt
    let systemPrompt
    if (truncatedContext) {
      systemPrompt = `You are Poli, an AI assistant specializing in New Era University policies and procedures. Base your responses on the following context:

${truncatedContext}

First provide a concise answer that directly addresses the query. Then support with evidence using direct quotes where helpful. Always cite specific article and section numbers from the source documents. If the information is from the most recent document, make sure to emphasize that.
`
    } else {
      systemPrompt = `You are Poli, an AI assistant specialized in New Era University policies and procedures. I don't have specific policy information to reference right now.`
    }

    try {
      // Build messages for Groq API
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ]

      const body = JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.1,
        max_tokens: 1024,
      })

      const groqResponse = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body
      })

      if (!groqResponse.ok) {
        const errorText = await groqResponse.text()
        console.error(`Groq API Error: ${groqResponse.status} ${errorText}`)
        
        // Handle token limit errors specifically
        if (errorText.includes("tokens") && errorText.includes("rate_limit_exceeded")) {
          return new Response(
            JSON.stringify({ 
              answer: "Your question requires processing a large amount of policy information. Please try asking a more specific question about a particular policy or section.",
              citations: []
            }),
            { 
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 413
            }
          )
        }
        
        throw new Error(`Groq API Error: ${groqResponse.status} ${errorText}`)
      }

      const data = await groqResponse.json()

      // Fetch the answer from the API response
      const text = data.choices?.[0]?.message?.content?.trim() || ""
      console.log("Groq answer fetched successfully, length:", text.length)

      // Process citations from the response
      const processedText = processTextWithCitations(text, documentInfo || {})
      
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
      console.error("Error calling Groq API:", error)
      return new Response(
        JSON.stringify({ 
          answer: "I encountered an error while processing your question. Please try a more specific query or try again later.",
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
