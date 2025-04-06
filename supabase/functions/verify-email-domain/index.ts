
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

    console.log("User found:", user.email);
    
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
      console.log(`Setting admin role for ${user.email}`);
      
      // Check if user exists in profiles
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileError) {
        console.error(`Error checking profile: ${profileError.message}`);
        
        // If profile doesn't exist, create it with admin role
        console.log(`Creating admin profile for user ${user.email}`);
        const { error: insertError } = await supabaseClient
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            role: 'admin'
          });
          
        if (insertError) {
          console.error(`Failed to create profile: ${insertError.message}`);
        }
      } else if (profileData.role !== 'admin') {
        // If profile exists but role is not admin, update it
        console.log(`Updating role to admin for user ${user.email}`);
        const { error: updateError } = await supabaseClient
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', user.id);
          
        if (updateError) {
          console.error(`Failed to update profile role: ${updateError.message}`);
        }
      } else {
        console.log(`User ${user.email} already has admin role`);
      }
      
      // Direct SQL query to ensure admin role is set
      const { error: rpcError } = await supabaseClient.rpc(
        'set_user_as_admin',
        { _email: user.email }
      );
      
      if (rpcError) {
        console.error(`Error calling set_user_as_admin: ${rpcError.message}`);
      } else {
        console.log(`Successfully called set_user_as_admin for ${user.email}`);
      }
    } catch (profileSetError) {
      console.error(`Error setting admin role: ${profileSetError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        message: "Email verification successful", 
        user: { id: user.id, email: user.email },
        admin_status: true
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`General error: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
