
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
      
      // Don't assume NEU email is admin, check the database instead
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
      
      // Set admin status based on the role in the database
      console.log("User role from database:", profileData.role);
      setIsAdmin(profileData.role === 'admin');
      
      // If it's an NEU email, verify the domain but don't override the role
      if (currentSession.user.email?.endsWith('@neu.edu.ph')) {
        console.log("NEU email detected, verifying domain but preserving role");
        
        // Using setTimeout to avoid auth deadlock
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
