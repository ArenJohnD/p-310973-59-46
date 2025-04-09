
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Header = () => {
  const { user, isAdmin, isLoading, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
  };

  const avatarUrl = user?.user_metadata?.avatar_url || null;

  return (
    <header className="bg-[#F1F1F1] shadow-sm">
      <div className="container mx-auto px-4 py-5 flex items-center">
        {/* Logo and Navigation together */}
        <div className="flex items-center space-x-10">
          {/* Logo */}
          <img
            src="https://cdn.builder.io/api/v1/image/assets/e3c6b0ec50df45b58e99e24af78e19b0/1cb33a4f0fb596171796038573ac1522f5a08704?placeholderIfAbsent=true"
            alt="NEU Logo"
            className="h-20 w-20 object-contain"
          />
        
          {/* Navigation */}
          <nav className="flex items-center">
            <div className="text-black text-xl font-medium flex gap-8">
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
        </div>
        
        {/* Right side icons - pushed to the right */}
        <div className="ml-auto flex items-center gap-8">
          <Bell className="h-8 w-8 text-gray-700" />
          
          {user && (
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger className="focus:outline-none">
                <Avatar className="h-12 w-12 bg-white border border-gray-200">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={user.email || "User"} />
                  ) : (
                    <AvatarFallback className="bg-white text-gray-800 text-lg">
                      {user.email?.substring(0, 2).toUpperCase() || "U"}
                    </AvatarFallback>
                  )}
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-full min-w-[220px] bg-white z-50 text-base">
                <div className="px-4 py-3 text-base font-medium break-words">
                  {user.email}
                  {isLoading && <span className="ml-2 text-xs">(checking permissions...)</span>}
                  {!isLoading && isAdmin && <span className="ml-2 text-xs text-green-600">(admin)</span>}
                </div>
                
                <DropdownMenuSeparator />
                
                {isAdmin && (
                  <DropdownMenuItem asChild className="cursor-pointer text-base">
                    <Link to="/admin" className="flex items-center">
                      <Settings className="mr-2 h-5 w-5" />
                      Admin Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-50 text-base"
                >
                  <LogOut className="mr-2 h-5 w-5" />
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
