
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, Bell } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Header = () => {
  const { user, isAdmin, isLoading, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    setIsOpen(false); // Close dropdown before sign out
    await signOut();
    // No need for navigation here - AuthContext will handle it
  };

  return (
    <header className="bg-[#F0F0F0] shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex-shrink-0">
          <img
            src="https://cdn.builder.io/api/v1/image/assets/e3c6b0ec50df45b58e99e24af78e19b0/1cb33a4f0fb596171796038573ac1522f5a08704?placeholderIfAbsent=true"
            alt="NEU Logo"
            className="h-16 w-16 object-contain"
          />
        </div>
        
        {/* Navigation - Centered */}
        <nav className="flex-grow flex justify-center">
          <div className="text-black text-lg font-medium flex gap-8">
            <Link to="/" className="hover:text-gray-700 transition-colors">
              Home
            </Link>
            <Link to="/about" className="hover:text-gray-700 transition-colors">
              About Us
            </Link>
            <Link to="/contact" className="hover:text-gray-700 transition-colors">
              Contact
            </Link>
          </div>
        </nav>
        
        {/* Right side icons */}
        <div className="flex items-center gap-4">
          <Bell className="h-6 w-6 text-gray-700" />
          
          {user && (
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger className="focus:outline-none">
                <Avatar className="h-10 w-10 bg-white border border-gray-200">
                  <AvatarFallback className="bg-white text-gray-800">
                    {user.email?.substring(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white">
                <div className="px-2 py-1.5 text-sm font-medium">
                  {user.email}
                  {isLoading && <span className="ml-2 text-xs">(checking permissions...)</span>}
                  {!isLoading && isAdmin && <span className="ml-2 text-xs text-green-600">(admin)</span>}
                </div>
                
                <DropdownMenuSeparator />
                
                {isAdmin && (
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link to="/admin" className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      Admin Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
};
