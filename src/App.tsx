
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
      navigate('/login', { replace: true, state: { from: location.pathname } });
    }
  }, [user, isLoading, navigate, location]);
  
  if (isLoading) {
    return <LoadingPage />;
  }
  
  return user ? <>{children}</> : null;
};

// Admin route component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // If not loading and no user, redirect to login
    if (!isLoading && !user) {
      navigate('/login', { replace: true, state: { from: location.pathname } });
    } 
    // If not loading, has user, but not admin, redirect to home
    else if (!isLoading && user && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [user, isAdmin, isLoading, navigate, location]);
  
  if (isLoading) {
    return <LoadingPage />;
  }
  
  return (user && isAdmin) ? <>{children}</> : null;
};

// Main App component without routes
function AppContent() {
  const { isLoading } = useAuth();
  const location = useLocation();
  
  // Immediately redirect to login page if at root
  useEffect(() => {
    if (location.pathname === '/') {
      const timeout = setTimeout(() => {
        // Force a refresh if still on loading page after 2 seconds
        if (document.querySelector('.animate-spin')) {
          window.location.href = '/login';
        }
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [location]);

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
