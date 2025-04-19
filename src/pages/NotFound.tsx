
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-4xl font-bold mb-4 text-red-600">404</h1>
          <p className="text-xl text-gray-700 mb-2">Oops! Page not found</p>
          <p className="text-gray-500 mb-6">
            The page you're looking for doesn't exist or has been moved.
            <br />
            <span className="text-sm">
              Attempted path: <code className="bg-gray-100 px-1 rounded">{location.pathname}</code>
            </span>
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              variant="default" 
              className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)]"
              asChild
            >
              <Link to="/">
                <Home className="mr-2 h-4 w-4" /> Return to Home
              </Link>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
