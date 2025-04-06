
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default when deployed.
      Deno.env.get("SUPABASE_URL") ?? "",
      // Supabase API SERVICE ROLE KEY - env var exported by default when deployed.
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the token from the authorization header
    const token = authHeader.replace("Bearer ", "");

    // Get the user from the token
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token or user not found" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if the email domain is from neu.edu.ph
    const isNeuEmail = user.email?.endsWith("@neu.edu.ph");

    if (!isNeuEmail) {
      // If not a NEU email, delete the user and return an error
      await supabaseClient.auth.admin.deleteUser(user.id);
      
      return new Response(
        JSON.stringify({ 
          error: "Access denied. Only @neu.edu.ph email addresses are allowed." 
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If they have a neu.edu.ph email, set them as admin
    try {
      // Use RPC to call the set_user_as_admin function
      await supabaseClient.rpc('set_user_as_admin', {
        _email: user.email
      });
      
      console.log(`User ${user.email} has been granted admin privileges`);
    } catch (adminError) {
      console.error(`Failed to set user as admin: ${adminError.message}`);
      // Continue with the flow even if setting admin role fails
    }

    return new Response(
      JSON.stringify({ 
        message: "Email verification successful", 
        user: { id: user.id, email: user.email } 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
