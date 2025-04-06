
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

  const checkAdminStatus = async (currentUser: User | null) => {
    if (!currentUser) {
      setIsAdmin(false);
      return;
    }

    try {
      console.log("Checking admin status for user:", currentUser.email);
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();
      
      if (profileError) {
        console.error("Error fetching user profile:", profileError);
        setIsAdmin(false);
        return;
      }
      
      console.log("User role from database:", profileData?.role);
      setIsAdmin(profileData?.role === 'admin');
    } catch (error) {
      console.error("Error in admin check:", error);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    console.log("Setting up auth context");
    let isActive = true; // Flag to prevent state updates after unmount
    
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isActive) return;
        console.log("Auth state change:", event);
        
        if (event === 'SIGNED_IN' && currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          
          // Use setTimeout to avoid Supabase auth deadlocks
          setTimeout(() => {
            if (isActive) {
              checkAdminStatus(currentSession.user);
            }
          }, 0);
          
          setIsLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setIsAdmin(false);
          setIsLoading(false);
          
          if (location.pathname !== '/login') {
            navigate('/login', { replace: true });
          }
        } else if (event === 'TOKEN_REFRESHED') {
          setSession(currentSession);
          setIsLoading(false);
        }
      }
    );
    
    // Then check for existing session
    const checkSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log("Initial session check:", currentSession ? "Session found" : "No session");
        
        if (!isActive) return;
        
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          
          // Use setTimeout to avoid Supabase auth deadlocks
          setTimeout(() => {
            if (isActive) {
              checkAdminStatus(currentSession.user);
            }
          }, 0);
        } 
        
        // Set loading to false regardless of whether session exists
        setTimeout(() => {
          if (isActive) {
            setIsLoading(false);
            
            // If no session and not on login page, redirect
            if (!currentSession && location.pathname !== '/login' && location.pathname !== '/') {
              navigate('/login', { replace: true });
            }
          }
        }, 500); // Short delay to prevent redirect flickers
      } catch (error) {
        console.error("Error checking session:", error);
        if (isActive) {
          setIsLoading(false);
          navigate('/login', { replace: true });
        }
      }
    };
    
    checkSession();

    return () => {
      console.log("Cleaning up auth context");
      isActive = false;
      subscription?.unsubscribe();
    };
  }, [navigate, location.pathname]);

  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Clear the session and redirect to login page
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear local state
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      
      // Force navigation to login and prevent browser back to protected pages
      navigate('/login', { replace: true });
      
      // Handle browser history to prevent back navigation
      window.history.pushState(null, '', '/login');
      
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
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
