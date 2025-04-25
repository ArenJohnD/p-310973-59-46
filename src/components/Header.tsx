import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, Bell, Menu, X } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <header className="relative bg-white border-b border-gray-100 shadow-sm z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          {/* Logo and Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="https://cdn.builder.io/api/v1/image/assets/e3c6b0ec50df45b58e99e24af78e19b0/1cb33a4f0fb596171796038573ac1522f5a08704?placeholderIfAbsent=true"
              alt="NEU Logo"
              className="h-16 w-16 sm:h-20 sm:w-20 object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-gray-900 group-hover:text-[rgba(49,159,67,1)] transition-colors">
                NEUPoliSeek
              </h1>
              <p className="text-sm text-gray-500">
                Policy Management System
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link 
              to="/" 
              className={cn(
                "px-4 py-2 rounded-lg transition-all duration-200",
                location.pathname === "/" 
                  ? "text-[rgba(49,159,67,1)] bg-[rgba(49,159,67,0.1)] font-medium" 
                  : "text-gray-600 hover:text-[rgba(49,159,67,1)] hover:bg-[rgba(49,159,67,0.05)]"
              )}
            >
              Home
            </Link>
            <Link 
              to="/about"
              className={cn(
                "px-4 py-2 rounded-lg transition-all duration-200",
                location.pathname === "/about"
                  ? "text-[rgba(49,159,67,1)] bg-[rgba(49,159,67,0.1)] font-medium"
                  : "text-gray-600 hover:text-[rgba(49,159,67,1)] hover:bg-[rgba(49,159,67,0.05)]"
              )}
            >
              About Us
            </Link>
            <Link 
              to="/contact"
              className={cn(
                "px-4 py-2 rounded-lg transition-all duration-200",
                location.pathname === "/contact"
                  ? "text-[rgba(49,159,67,1)] bg-[rgba(49,159,67,0.1)] font-medium"
                  : "text-gray-600 hover:text-[rgba(49,159,67,1)] hover:bg-[rgba(49,159,67,0.05)]"
              )}
            >
              Contact
            </Link>
          </nav>

          {/* Right side icons */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="relative hidden sm:flex hover:bg-[rgba(49,159,67,0.1)] text-gray-600 hover:text-[rgba(49,159,67,1)]"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[rgba(49,159,67,1)] rounded-full" />
            </Button>

            {/* User Menu */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="relative h-10 w-10 rounded-full border-2 border-gray-200 hover:border-[rgba(49,159,67,1)] transition-colors"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.user_metadata?.avatar_url} />
                      <AvatarFallback className="bg-[rgba(49,159,67,0.1)] text-[rgba(49,159,67,1)]">
                        {user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.email}</p>
                      <p className="text-xs leading-none text-gray-500">
                        {isAdmin ? 'Administrator' : 'User'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isAdmin && (
                    <DropdownMenuItem 
                      onClick={() => navigate('/admin')}
                      className="text-[rgba(49,159,67,1)] hover:text-[rgba(49,159,67,1)] hover:bg-[rgba(49,159,67,0.1)]"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Admin Dashboard</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => supabase.auth.signOut()}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="default"
                className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)] text-white hidden sm:flex"
                onClick={() => navigate('/login')}
              >
                Sign In
              </Button>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "fixed inset-x-0 top-[73px] p-4 bg-white border-t border-b border-gray-100 shadow-sm md:hidden transition-all duration-200 ease-in-out",
          isMobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        )}
      >
        <nav className="flex flex-col space-y-1">
          <Link
            to="/"
            className={cn(
              "px-4 py-3 rounded-lg transition-all duration-200",
              location.pathname === "/"
                ? "text-[rgba(49,159,67,1)] bg-[rgba(49,159,67,0.1)] font-medium"
                : "text-gray-600 hover:text-[rgba(49,159,67,1)] hover:bg-[rgba(49,159,67,0.05)]"
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Home
          </Link>
          <Link
            to="/about"
            className={cn(
              "px-4 py-3 rounded-lg transition-all duration-200",
              location.pathname === "/about"
                ? "text-[rgba(49,159,67,1)] bg-[rgba(49,159,67,0.1)] font-medium"
                : "text-gray-600 hover:text-[rgba(49,159,67,1)] hover:bg-[rgba(49,159,67,0.05)]"
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            About Us
          </Link>
          <Link
            to="/contact"
            className={cn(
              "px-4 py-3 rounded-lg transition-all duration-200",
              location.pathname === "/contact"
                ? "text-[rgba(49,159,67,1)] bg-[rgba(49,159,67,0.1)] font-medium"
                : "text-gray-600 hover:text-[rgba(49,159,67,1)] hover:bg-[rgba(49,159,67,0.05)]"
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Contact
          </Link>
          {!user && (
            <Button
              variant="default"
              className="w-full mt-2 bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)] text-white"
              onClick={() => {
                navigate('/login');
                setIsMobileMenuOpen(false);
              }}
            >
              Sign In
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
};
