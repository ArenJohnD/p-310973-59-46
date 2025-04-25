import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Loader2, AlertCircle, BookOpen, Shield, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { motion } from "framer-motion";

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F1F1F1] via-white to-[#E8F5E9] relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzYuMjUyIDUuMTAyYy0uOTc4IDEuNTMtMS41MyAzLjMyNi0xLjUzIDUuMjU4IDAgNS40NDMgNC40MSA5Ljg1NCA5Ljg1NCA5Ljg1NCAyLjExNCAwIDQuMDY4LS42NjYgNS42Ny0xLjc5NmwtMy43NS0zLjc1Yy0uODEyLjM4OC0xLjcyLjYwNC0yLjY4Mi42MDQtMy40NCAwLTYuMjI4LTIuNzg4LTYuMjI4LTYuMjI4IDAtLjc5Mi4xNDgtMS41NDguNDE4LTIuMjQ0bC0xLjc1Mi0xLjY5OHptMTMuMzU0IDEzLjM1NGMtLjk3OCAxLjUzLTEuNTMgMy4zMjYtMS41MyA1LjI1OCAwIDUuNDQzIDQuNDEgOS44NTQgOS44NTQgOS44NTQgMi4xMTQgMCA0LjA2OC0uNjY2IDUuNjctMS43OTZsLTMuNzUtMy43NWMtLjgxMi4zODgtMS43Mi42MDQtMi42ODIuNjA0LTMuNDQgMC02LjIyOC0yLjc4OC02LjIyOC02LjIyOCAwLS43OTIuMTQ4LTEuNTQ4LjQxOC0yLjI0NGwtMS43NTItMS42OTh6IiBmaWxsPSJyZ2JhKDQ5LDE1OSw2NywwLjAzKSIgZmlsbC1ydWxlPSJub256ZXJvIi8+PC9nPjwvc3ZnPg==')] opacity-50" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-4 z-10"
        >
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-[rgba(49,159,67,1)]" />
            <div className="absolute inset-0 bg-[rgba(49,159,67,0.1)] rounded-full blur-xl" />
          </div>
          <p className="text-xl font-medium text-gray-700">Initializing...</p>
          <p className="text-sm text-gray-500">Please wait while we set things up</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#F1F1F1] via-white to-[#E8F5E9]" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzYuMjUyIDUuMTAyYy0uOTc4IDEuNTMtMS41MyAzLjMyNi0xLjUzIDUuMjU4IDAgNS40NDMgNC40MSA5Ljg1NCA5Ljg1NCA5Ljg1NCAyLjExNCAwIDQuMDY4LS42NjYgNS42Ny0xLjc5NmwtMy43NS0zLjc1Yy0uODEyLjM4OC0xLjcyLjYwNC0yLjY4Mi42MDQtMy40NCAwLTYuMjI4LTIuNzg4LTYuMjI4LTYuMjI4IDAtLjc5Mi4xNDgtMS41NDguNDE4LTIuMjQ0bC0xLjc1Mi0xLjY5OHptMTMuMzU0IDEzLjM1NGMtLjk3OCAxLjUzLTEuNTMgMy4zMjYtMS41MyA1LjI1OCAwIDUuNDQzIDQuNDEgOS44NTQgOS44NTQgOS44NTQgMi4xMTQgMCA0LjA2OC0uNjY2IDUuNjctMS43OTZsLTMuNzUtMy43NWMtLjgxMi4zODgtMS43Mi42MDQtMi42ODIuNjA0LTMuNDQgMC02LjIyOC0yLjc4OC02LjIyOC02LjIyOCAwLS43OTIuMTQ4LTEuNTQ4LjQxOC0yLjI0NGwtMS43NTItMS42OTh6IiBmaWxsPSJyZ2JhKDQ5LDE1OSw2NywwLjAzKSIgZmlsbC1ydWxlPSJub256ZXJvIi8+PC9nPjwvc3ZnPg==')] opacity-50" />
      
      {/* Animated gradient orbs */}
      <div className="absolute inset-0">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            y: [0, -30, 0]
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-[rgba(49,159,67,0.2)] to-transparent rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
            x: [0, -30, 0]
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-[rgba(49,159,67,0.15)] to-transparent rounded-full blur-3xl"
        />
      </div>

      {/* Content */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="container max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-center gap-8">
          {/* Left side - Info panel */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full md:w-1/2 text-center md:text-left"
          >
            <div className="mb-6 relative">
              <motion.div
                animate={{
                  y: [0, -8, 0],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <img
                  src="https://cdn.builder.io/api/v1/image/assets/e3c6b0ec50df45b58e99e24af78e19b0/1cb33a4f0fb596171796038573ac1522f5a08704?placeholderIfAbsent=true"
                  alt="NEU Logo"
                  className="h-20 w-20 object-contain mx-auto md:mx-0 mb-4 drop-shadow-lg"
                />
              </motion.div>
              <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[rgba(49,159,67,1)] to-[rgba(39,139,57,1)]">NEUPoliSeek</h1>
              <p className="text-xl text-gray-600">Your Gateway to University Policies</p>
            </div>
            
            <div className="space-y-6 max-w-md mx-auto md:mx-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex items-start gap-4 p-4 bg-white/90 backdrop-blur-sm rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
              >
                <div className="bg-[rgba(49,159,67,0.1)] p-3 rounded-lg">
                  <BookOpen className="h-6 w-6 text-[rgba(49,159,67,1)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Comprehensive Policy Library</h3>
                  <p className="text-gray-600 text-sm">Access all New Era University policies in one place</p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex items-start gap-4 p-4 bg-white/90 backdrop-blur-sm rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
              >
                <div className="bg-[rgba(49,159,67,0.1)] p-3 rounded-lg">
                  <Shield className="h-6 w-6 text-[rgba(49,159,67,1)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Secure Access</h3>
                  <p className="text-gray-600 text-sm">Protected access for university members only</p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex items-start gap-4 p-4 bg-white/90 backdrop-blur-sm rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
              >
                <div className="bg-[rgba(49,159,67,0.1)] p-3 rounded-lg">
                  <Users className="h-6 w-6 text-[rgba(49,159,67,1)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Guest Access Available</h3>
                  <p className="text-gray-600 text-sm">Limited access for non-university members</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
          
          {/* Right side - Login card */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full md:w-1/2 max-w-md"
          >
            <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-md">
              <CardHeader className="space-y-4 text-center pb-6">
                <CardTitle className="text-2xl font-bold text-gray-900">
                  Welcome Back!
                </CardTitle>
                <CardDescription className="text-base text-gray-600">
                  Sign in to access New Era University policies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Alert variant="destructive" className="mb-6">
                      <AlertCircle className="h-5 w-5" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="space-y-4"
                >
                  <Button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)] py-6 relative overflow-hidden group rounded-xl"
                  >
                    <div className="absolute inset-0 bg-white/10 transform -skew-x-12 translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                    <div className="relative flex items-center justify-center">
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      ) : (
                        <img
                          src="https://img.icons8.com/?size=100&id=17950&format=png&color=FFFFFF"
                          alt="Google"
                          className="h-5 w-5 mr-2"
                        />
                      )}
                      <span>Sign in with Google</span>
                    </div>
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">or</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleGuestAccess}
                    variant="outline"
                    className="w-full py-6 border-2 border-gray-200 hover:border-[rgba(49,159,67,1)] hover:bg-[rgba(49,159,67,0.05)] text-[rgba(49,159,67,1)] font-semibold transition-colors duration-200 rounded-xl"
                  >
                    Continue as Guest
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;
