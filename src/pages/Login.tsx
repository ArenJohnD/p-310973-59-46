
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initTimeout, setInitTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setInitializing(false);
      console.log("Login init timeout reached, exiting loading state");
    }, 2000);
    setInitTimeout(timeout);
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const handleHashParameters = async () => {
      console.log("Checking login state, hash present:", !!window.location.hash);
      if (window.location.hash) {
        setLoading(true);
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (data.session) {
            console.log("Received session from OAuth callback");
            const email = data.session.user.email;
            if (email && !email.toLowerCase().endsWith('@neu.edu.ph')) {
              console.error("Invalid email domain:", email);
              await supabase.auth.signOut();
              setError("Only emails with @neu.edu.ph domain are allowed to sign in.");
              setLoading(false);
              window.location.hash = '';
              return;
            }
            window.location.hash = '';
            navigate('/', { replace: true });
          }
        } catch (error) {
          console.error("Error handling hash parameters:", error);
          toast({
            title: "Login error",
            description: "An error occurred while processing your login",
            variant: "destructive",
          });
          setLoading(false);
        }
        if (initTimeout) clearTimeout(initTimeout);
        setInitializing(false);
        return;
      }
      const checkSession = async () => {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            const email = data.session.user.email;
            if (email && !email.toLowerCase().endsWith('@neu.edu.ph')) {
              console.error("Invalid email domain:", email);
              await supabase.auth.signOut();
              setError("Only emails with @neu.edu.ph domain are allowed to sign in.");
              setLoading(false);
              return;
            }
            console.log("User already has a session, redirecting to home");
            navigate('/', { replace: true });
            return;
          }
        } catch (error) {
          console.error("Error checking session:", error);
        } finally {
          if (initTimeout) clearTimeout(initTimeout);
          setInitializing(false);
        }
      };
      await checkSession();
    };
    handleHashParameters();
    return () => {
      if (initTimeout) clearTimeout(initTimeout);
    };
  }, [navigate, initTimeout]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            hd: 'neu.edu.ph',
            login_hint: '@neu.edu.ph',
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error("Error signing in with Google:", error);
      toast({
        title: "Sign in error",
        description: "Failed to sign in with Google. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleGuestAccess = () => {
    // Clear any prior session (just in case), then go to guest chat
    navigate('/guest-chat');
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[rgba(233,233,233,1)]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-[rgba(49,159,67,1)]" />
          <p className="text-lg font-medium">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgba(233,233,233,1)]">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img
            src="https://cdn.builder.io/api/v1/image/assets/e3c6b0ec50df45b58e99e24af78e19b0/1cb33a4f0fb596171796038573ac1522f5a08704?placeholderIfAbsent=true"
            alt="NEU Logo"
            className="h-24 w-24 object-contain mb-4"
          />
          <h1 className="text-2xl font-bold text-center">Welcome to NEUPoliSeek!</h1>
          <p className="text-gray-500 text-center mt-2">
            Sign in to access New Era University policies.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <Button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)] py-6"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <img
                src="https://developers.google.com/identity/images/g-logo.png"
                alt="Google"
                className="h-5 w-5 mr-2"
              />
            )}
            <span>Sign in with Google (@neu.edu.ph only)</span>
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-[1px] bg-gray-300" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-[1px] bg-gray-300" />
          </div>
          <Button
            onClick={handleGuestAccess}
            variant="outline"
            className="w-full py-6 border-gray-300 bg-white hover:bg-gray-50 text-[rgba(49,159,67,1)] font-semibold"
          >
            Continue as Guest
          </Button>
          <p className="text-sm text-center text-gray-500">
            Only New Era University accounts (@neu.edu.ph) are allowed to sign in.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
