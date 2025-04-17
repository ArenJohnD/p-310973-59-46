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
  refreshAdminStatus: () => Promise<boolean>; 
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
      console.log("No user to check admin status for");
      setIsAdmin(false);
      return false;
    }

    try {
      console.log("Checking admin status for user:", currentUser.email);
      
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

  const refreshAdminStatus = async () => {
    return await checkAdminStatus(user);
  };

  const updateUserActivityStatus = async (userId: string | undefined, isActive: boolean) => {
    if (!userId) return;
    
    console.log(`Setting user ${userId} activity status to ${isActive ? 'active' : 'inactive'}`);
    
    try {
      const { error } = await supabase.rpc("update_user_activity_status", {
        user_id: userId,
        is_active: isActive
      });
      
      if (error) {
        console.error("Error updating activity status:", error);
      } else {
        console.log("Successfully updated user activity status");
      }
    } catch (error) {
      console.error("Exception in updateUserActivityStatus:", error);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    const handleBeforeUnload = () => {
      updateUserActivityStatus(user.id, false);
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateUserActivityStatus(user.id, false);
      } else if (document.visibilityState === 'visible' && user) {
        updateUserActivityStatus(user.id, true);
      }
    };
    
    updateUserActivityStatus(user.id, true);
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const pingInterval = setInterval(() => {
      if (user && document.visibilityState === 'visible') {
        updateUserActivityStatus(user.id, true);
      }
    }, 60000);
    
    return () => {
      updateUserActivityStatus(user?.id, false);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pingInterval);
    };
  }, [user]);

  useEffect(() => {
    console.log("Setting up auth context");
    let isActive = true;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isActive) return;
        console.log("Auth state change:", event);
        
        if (event === 'SIGNED_IN' && currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          
          updateUserActivityStatus(currentSession.user.id, true);
          
          setTimeout(() => {
            if (isActive) {
              checkAdminStatus(currentSession.user);
              setIsLoading(false);
            }
          }, 100);
        } else if (event === 'SIGNED_OUT') {
          console.log("User signed out, clearing state");
          
          if (user) {
            updateUserActivityStatus(user.id, false);
          }
          
          setUser(null);
          setSession(null);
          setIsAdmin(false);
          setIsLoading(false);
          
          if (location.pathname !== '/login') {
            navigate('/login', { replace: true });
          }
          
          window.history.pushState(null, '', '/login');
        } else if (event === 'TOKEN_REFRESHED') {
          console.log("Token refreshed");
          setSession(currentSession);
          setIsLoading(false);
        }
      }
    );
    
    const checkSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log("Initial session check:", currentSession ? "Session found" : "No session");
        
        if (!isActive) return;
        
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          
          setTimeout(() => {
            if (isActive) {
              checkAdminStatus(currentSession.user);
            }
          }, 100);
        } 
        
        setTimeout(() => {
          if (isActive) {
            setIsLoading(false);
            
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
    
    const loadingTimeout = setTimeout(() => {
      if (isActive && isLoading) {
        console.log("Auth context maximum loading time reached");
        setIsLoading(false);
      }
    }, 3000);
    
    checkSession();

    return () => {
      isActive = false;
      subscription?.unsubscribe();
      clearTimeout(loadingTimeout);
      
      if (user) {
        updateUserActivityStatus(user.id, false);
      }
    };
  }, [navigate, location.pathname]);

  const signOut = async () => {
    try {
      setIsLoading(true);
      
      if (user) {
        await updateUserActivityStatus(user.id, false);
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      
      navigate('/login', { replace: true });
      
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
