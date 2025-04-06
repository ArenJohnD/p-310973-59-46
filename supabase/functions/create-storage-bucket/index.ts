
// This Edge Function creates the required storage bucket if it doesn't exist

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if bucket exists
    const { data: buckets, error: bucketsError } = await supabaseClient
      .storage
      .listBuckets();
    
    if (bucketsError) {
      throw bucketsError;
    }

    const policyDocumentsBucket = buckets?.find(bucket => bucket.name === 'policy-documents');
    
    if (!policyDocumentsBucket) {
      // Create bucket
      const { data, error } = await supabaseClient
        .storage
        .createBucket('policy-documents', {
          public: true,
          fileSizeLimit: 10485760, // 10MB
        });
        
      if (error) {
        throw error;
      }
      
      // Add policies to allow authenticated users to read
      await supabaseClient
        .storage
        .from('policy-documents')
        .setPublic();
      
      return new Response(
        JSON.stringify({ message: 'Policy documents bucket created successfully', data }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      return new Response(
        JSON.stringify({ message: 'Policy documents bucket already exists' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
