
import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode 
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useNavigate, useLocation } from "react-router-dom";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const checkAdminStatus = async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setIsAdmin(false);
      return;
    }

    try {
      console.log("Checking admin status for user:", currentSession.user.email);
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentSession.user.id)
        .single();
      
      if (profileError) {
        console.error("Error fetching user profile:", profileError);
        setIsAdmin(false);
        return;
      }
      
      console.log("User role from database:", profileData.role);
      setIsAdmin(profileData.role === 'admin');
      
      if (currentSession.user.email?.endsWith('@neu.edu.ph')) {
        console.log("NEU email detected, verifying domain but preserving role");
        
        setTimeout(() => {
          supabase.functions.invoke('verify-email-domain', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${currentSession.access_token}`
            }
          }).catch(error => {
            console.error("Error verifying email domain:", error);
          });
        }, 500);
      }
    } catch (error) {
      console.error("Error in admin check:", error);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    console.log("Setting up auth context");
    
    // First check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Initial session check:", session ? "Session found" : "No session");
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session) {
        // Only check admin status if session exists
        checkAdminStatus(session).then(() => {
          setIsLoading(false);
          // Only redirect if on login page and we have a session
          if (location.pathname === '/login') {
            navigate('/', { replace: true });
          }
        });
      } else {
        setIsLoading(false);
        // Only redirect to login if not already there and not on initial load
        if (location.pathname !== '/login' && location.pathname !== '/') {
          navigate('/login', { replace: true });
        }
      }
    });
    
    // Set up auth state listener 
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change:", event);
        
        if (event === 'SIGNED_IN' && session) {
          setSession(session);
          setUser(session.user);
          await checkAdminStatus(session);
          
          // Only navigate if on login page
          if (location.pathname === '/login') {
            navigate('/', { replace: true });
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setIsAdmin(false);
          navigate('/login', { replace: true });
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      console.log("Cleaning up auth context");
      subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  const signOut = async () => {
    try {
      setIsLoading(true); // Set loading state to prevent multiple clicks
      navigate('/login', { replace: true });
      
      // Delay the actual sign out to ensure navigation happens first
      setTimeout(async () => {
        await supabase.auth.signOut();
        toast({
          title: "Signed out",
          description: "You have been successfully signed out.",
        });
        setIsLoading(false);
      }, 100);
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const value = {
    user,
    session,
    isLoading,
    isAdmin,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
