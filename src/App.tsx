import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation
} from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from "lucide-react";

// Lazy load pages for better performance
const Index = lazy(() => import("@/pages/Index"));
const Login = lazy(() => import("@/pages/Login"));
const Admin = lazy(() => import("@/pages/Admin"));
const PolicyDocuments = lazy(() => import("@/pages/PolicyDocuments"));
const PDFViewer = lazy(() => import("@/pages/PDFViewer"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Loading component
const LoadingPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-[rgba(233,233,233,1)]">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="h-8 w-8 animate-spin text-[rgba(49,159,67,1)]" />
      <p className="text-lg font-medium">Loading...</p>
    </div>
  </div>
);

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // If not loading and no user, redirect to login
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

// Admin route component with immediate redirect
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, isLoading, refreshAdminStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    const checkAdminAccess = async () => {
      // Refresh admin status to ensure it's accurate
      await refreshAdminStatus();
      
      // If not loading and not admin, redirect immediately
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
  
  // Only render children if user exists and is admin
  return (user && isAdmin) ? <>{children}</> : null;
};

// Import toast for admin route
import { toast } from "@/components/ui/use-toast";

// Main App component without routes
function AppContent() {
  const { isLoading, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Immediately redirect to login page if at root
  useEffect(() => {
    if (location.pathname === '/') {
      if (isLoading) {
        // Set a timeout to force navigate to login if still on loading after delay
        const timeout = setTimeout(() => {
          console.log("Root path timeout triggered, navigating to login");
          navigate('/login', { replace: true });
        }, 1000); // Reduced timeout for faster redirection
        
        return () => clearTimeout(timeout);
      } else if (!user) {
        console.log("Root path, no user, redirecting to login");
        navigate('/login', { replace: true });
      }
    } else if (location.pathname === '/login' && user && !isLoading) {
      // If already logged in and on login page, redirect to home
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

// Main App component with providers
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
