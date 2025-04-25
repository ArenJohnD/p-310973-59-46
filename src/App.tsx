import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation
} from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

const queryClient = new QueryClient();

const Index = lazy(() => import("@/pages/Index"));
const Login = lazy(() => import("@/pages/Login"));
const Admin = lazy(() => import("@/pages/Admin"));
const PolicyDocuments = lazy(() => import("@/pages/PolicyDocuments"));
const PDFViewer = lazy(() => import("@/pages/PDFViewer"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const LoadingPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-[rgba(233,233,233,1)]">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="h-8 w-8 animate-spin text-[rgba(49,159,67,1)]" />
      <p className="text-lg font-medium">Loading...</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    if (!isLoading && !user) {
      console.log("No user detected, redirecting to login");
      navigate('/login', { replace: true, state: { from: location.pathname } });
    }
  }, [user, isLoading, navigate, location]);
  
  if (isLoading) {
    return <LoadingPage />;
  }
  
  return user ? <>{children}</> : null;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, isLoading, refreshAdminStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    const checkAdminAccess = async () => {
      await refreshAdminStatus();
      
      if (!isLoading) {
        if (!user) {
          console.log("No user detected in AdminRoute, redirecting to login");
          navigate('/login', { replace: true, state: { from: location.pathname } });
        } 
        else if (!isAdmin) {
          console.log("User is not an admin, redirecting to home");
          navigate('/', { replace: true });
          toast({
            title: "Access denied",
            description: "You don't have admin privileges",
            variant: "destructive"
          });
        }
      }
    };
    
    checkAdminAccess();
  }, [user, isAdmin, isLoading, navigate, location, refreshAdminStatus]);
  
  if (isLoading) {
    return <LoadingPage />;
  }
  
  return (user && isAdmin) ? <>{children}</> : null;
};

function AppContent() {
  const { isLoading, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (location.pathname === '/') {
      if (isLoading) {
        const timeout = setTimeout(() => {
          console.log("Root path timeout triggered, navigating to login");
          navigate('/login', { replace: true });
        }, 1000);
        
        return () => clearTimeout(timeout);
      } else if (!user) {
        console.log("Root path, no user, redirecting to login");
        navigate('/login', { replace: true });
      }
    } else if (location.pathname === '/login' && user && !isLoading) {
      console.log("User already logged in, redirecting from login to home");
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate, isLoading, user]);

  return (
    <Suspense fallback={<LoadingPage />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <AdminRoute>
            <Admin />
          </AdminRoute>
        } />
        <Route path="/policy/:id" element={
          <ProtectedRoute>
            <PolicyDocuments />
          </ProtectedRoute>
        } />
        <Route path="/policy-viewer/:id" element={
          <ProtectedRoute>
            <PDFViewer />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppContent />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
