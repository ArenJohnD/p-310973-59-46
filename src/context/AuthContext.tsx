
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

  const checkAdminStatus = async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setIsAdmin(false);
      return;
    }

    try {
      console.log("Checking admin status for user:", currentSession.user.email);
      
      // Email is from NEU domain
      if (currentSession.user.email?.endsWith('@neu.edu.ph')) {
        console.log("NEU email detected, setting admin status to true");
        setIsAdmin(true);
        
        // We'll do a verification anyway to update the database if needed
        setTimeout(() => { // Using setTimeout to avoid auth deadlock
          supabase.functions.invoke('verify-email-domain', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${currentSession.access_token}`
            }
          }).catch(error => {
            console.error("Error verifying email domain:", error);
          });
        }, 500);
        
        return;
      }
      
      // Fall back to using the RPC function
      const { data, error } = await supabase.rpc('is_admin');
      
      if (error) {
        console.error("Error checking admin status with RPC:", error);
        setIsAdmin(false);
      } else {
        console.log("is_admin RPC result:", data);
        setIsAdmin(!!data);
      }
    } catch (error) {
      console.error("Error in admin check:", error);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    console.log("Setting up auth context");
    
    // FIRST check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Initial session check:", session ? "Session found" : "No session");
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session) {
        checkAdminStatus(session);
      }
      
      setIsLoading(false);
    });
    
    // THEN set up auth state listener 
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change:", event);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session) {
          await checkAdminStatus(session);
        } else {
          setIsAdmin(false);
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      console.log("Cleaning up auth context");
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
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
