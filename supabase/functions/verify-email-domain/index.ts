
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

    // If they have a neu.edu.ph email, make sure they are set as admin in the profiles table
    try {
      // Check if user exists in profiles
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') {
        // If there's an error other than "not found"
        console.error(`Error checking profile: ${profileError.message}`);
      }
      
      if (!profileData) {
        // If profile doesn't exist, create it with admin role
        const { error: insertError } = await supabaseClient
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            role: 'admin'
          });
          
        if (insertError) {
          console.error(`Failed to create profile: ${insertError.message}`);
        } else {
          console.log(`Created admin profile for user ${user.email}`);
        }
      } else if (profileData.role !== 'admin') {
        // If profile exists but role is not admin, update it
        const { error: updateError } = await supabaseClient
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', user.id);
          
        if (updateError) {
          console.error(`Failed to update profile role: ${updateError.message}`);
        } else {
          console.log(`Updated role to admin for user ${user.email}`);
        }
      }
    } catch (profileSetError) {
      console.error(`Error setting admin role: ${profileSetError.message}`);
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
