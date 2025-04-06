
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Handle URL hash parameters on page load (OAuth callback)
    const handleHashParameters = async () => {
      if (window.location.hash) {
        setLoading(true);
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          
          if (data.session) {
            console.log("Received session from OAuth callback");
            // If we have a session, clear the hash and navigate to home page
            window.location.hash = '';
            navigate('/');
          }
        } catch (error) {
          console.error("Error handling hash parameters:", error);
          toast({
            title: "Login error",
            description: "An error occurred while processing your login",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      }
    };
    
    handleHashParameters();
    
    // Check if user is already logged in
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        console.log("User already has a session");
        navigate('/');
      }
    };
    
    if (!window.location.hash) {
      // Only check session if we're not handling hash parameters
      checkSession();
    }

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state change:", event);
        if (event === "SIGNED_IN" && session) {
          navigate('/');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      console.log("Initiating Google login");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          redirectTo: window.location.origin + "/login",
        },
      });

      if (error) {
        console.error("Login failed:", error);
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error logging in:", error);
      toast({
        title: "Login error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-[rgba(233,233,233,1)]">
      <div className="w-full max-w-md mt-20 px-6 py-8 bg-white rounded-3xl shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <img
            src="https://cdn.builder.io/api/v1/image/assets/e3c6b0ec50df45b58e99e24af78e19b0/1cb33a4f0fb596171796038573ac1522f5a08704?placeholderIfAbsent=true"
            alt="NEUPoliSeek Logo"
            className="aspect-[1] object-contain w-[101px]"
          />
          <h1 className="text-black text-3xl font-bold mt-6">NEUPoliSeek</h1>
          <p className="text-black text-xl font-semibold mt-2 text-center">
            Find, Understand, and Navigate School Policies with Ease.
          </p>
        </div>

        <div className="text-center mb-8">
          <p className="text-black text-lg">
            Login with your NEU email address to access school policies.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            (Only @neu.edu.ph email addresses are allowed)
          </p>
        </div>

        <Button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)] h-12 text-lg font-semibold"
        >
          {loading ? "Signing in..." : "Sign in with Google"}
        </Button>
      </div>
    </div>
  );
};

export default Login;
