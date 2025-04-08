
import { useState } from "react";
import { ChatBot } from "./ChatBot";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const SearchBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  return (
    <div className={`mx-auto transition-all duration-300 ${isMaximized ? 'fixed inset-0 z-50 p-4 bg-white/95' : 'w-full max-w-[1002px]'}`}>
      <div className="relative">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-2 top-2 z-10"
          onClick={toggleMaximize}
        >
          {isMaximized ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </Button>
        <ChatBot />
      </div>
    </div>
  );
};
