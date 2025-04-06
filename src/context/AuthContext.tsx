
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
  refreshAdminStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user is admin by directly querying the profiles table
  const checkAdminStatus = async (currentUser: User | null) => {
    if (!currentUser) {
      console.log("No user to check admin status for");
      setIsAdmin(false);
      return false;
    }

    try {
      console.log("Checking admin status for user:", currentUser.email);
      
      // Direct query to get user's role from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();
      
      if (profileError) {
        console.error("Error fetching profile:", profileError);
        setIsAdmin(false);
        return false;
      }
      
      console.log("User profile data:", profileData);
      
      // Check if user has admin role
      if (profileData?.role === 'admin') {
        console.log("User is confirmed as admin");
        setIsAdmin(true);
        return true;
      } else {
        console.log("User is not an admin, role:", profileData?.role);
        setIsAdmin(false);
        return false;
      }
    } catch (error) {
      console.error("Error in admin check:", error);
      setIsAdmin(false);
      return false;
    }
  };

  // Function to refresh admin status - can be called externally
  const refreshAdminStatus = async () => {
    return await checkAdminStatus(user);
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
              setIsLoading(false);
            }
          }, 100);
        } else if (event === 'SIGNED_OUT') {
          console.log("User signed out, clearing state");
          setUser(null);
          setSession(null);
          setIsAdmin(false);
          setIsLoading(false);
          
          if (location.pathname !== '/login') {
            navigate('/login', { replace: true });
          }
          
          // Prevent browser back after logout
          window.history.pushState(null, '', '/login');
        } else if (event === 'TOKEN_REFRESHED') {
          console.log("Token refreshed");
          setSession(currentSession);
          setIsLoading(false);
        }
      }
    );
    
    // Then check for existing session with a timeout to prevent hanging
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
          }, 100);
        } 
        
        // Set loading to false regardless of whether session exists
        setTimeout(() => {
          if (isActive) {
            setIsLoading(false);
            
            // Redirect if needed but only after loading is complete
            if (!currentSession && location.pathname !== '/login' && location.pathname !== '/') {
              navigate('/login', { replace: true });
            }
          }
        }, 500);
      } catch (error) {
        console.error("Error checking session:", error);
        if (isActive) {
          setIsLoading(false);
          navigate('/login', { replace: true });
        }
      }
    };
    
    // Add a maximum timeout to prevent hanging in loading state
    const loadingTimeout = setTimeout(() => {
      if (isActive && isLoading) {
        console.log("Auth context maximum loading time reached");
        setIsLoading(false);
      }
    }, 3000);
    
    checkSession();

    return () => {
      console.log("Cleaning up auth context");
      isActive = false;
      subscription?.unsubscribe();
      clearTimeout(loadingTimeout);
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
    refreshAdminStatus,
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
