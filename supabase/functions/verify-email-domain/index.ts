
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()
    console.log(`Verifying email domain for: ${email}`)

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if the email ends with @neu.edu.ph
    const isValidDomain = email.toLowerCase().endsWith('@neu.edu.ph')
    console.log(`Email domain validation result: ${isValidDomain}`)

    return new Response(
      JSON.stringify({ isValid: isValidDomain }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error verifying email domain:', error)
    
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
