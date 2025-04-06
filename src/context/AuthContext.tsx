
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
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log("Setting up auth context");
    
    // FIRST check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Initial session check:", session ? "Session found" : "No session");
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      // If we have a session with NEU email, make sure they're set as admin
      if (session?.user?.email?.endsWith('@neu.edu.ph')) {
        console.log("NEU email detected, verifying admin status");
        supabase.functions.invoke('verify-email-domain', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }).catch(error => {
          console.error("Error verifying email domain:", error);
        });
      }
    });
    
    // THEN set up auth state listener 
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state change:", event);
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
        
        if (event === 'SIGNED_IN' && session?.user?.email?.endsWith('@neu.edu.ph')) {
          console.log("User signed in with NEU email");
          // Extra check to ensure admin status is applied
          supabase.functions.invoke('verify-email-domain', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          }).catch(error => {
            console.error("Error verifying email domain on sign in:", error);
          });
        }
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
