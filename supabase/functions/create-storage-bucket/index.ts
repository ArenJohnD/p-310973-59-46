
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
    // Create a Supabase client with the Admin key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log("Checking if policy-documents bucket exists...");

    // Check if bucket exists
    const { data: buckets, error: bucketsError } = await supabaseAdmin
      .storage
      .listBuckets();
    
    if (bucketsError) {
      console.error("Error listing buckets:", bucketsError);
      throw bucketsError;
    }

    const policyDocumentsBucket = buckets?.find(bucket => bucket.name === 'policy-documents');
    
    if (!policyDocumentsBucket) {
      console.log("Bucket does not exist. Creating policy-documents bucket...");
      
      // Create bucket
      const { data, error } = await supabaseAdmin
        .storage
        .createBucket('policy-documents', {
          public: true,
          fileSizeLimit: 10485760, // 10MB
        });
        
      if (error) {
        console.error("Error creating bucket:", error);
        throw error;
      }

      console.log("Bucket created successfully:", data);
      
      return new Response(
        JSON.stringify({ message: 'Policy documents bucket created successfully', data }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      console.log("Bucket already exists:", policyDocumentsBucket.name);
      return new Response(
        JSON.stringify({ message: 'Policy documents bucket already exists' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error) {
    console.error("Error in create-storage-bucket function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
