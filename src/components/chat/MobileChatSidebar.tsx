
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { ChatSidebar } from "./ChatSidebar";

interface MobileChatSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MobileChatSidebar = ({
  open,
  onOpenChange,
}: MobileChatSidebarProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="absolute left-2 top-2 z-10 transition-transform duration-200 ease-in-out hover:scale-105"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[80vh]">
        <div className="px-4 py-6 h-full flex flex-col overflow-hidden">
          <ChatSidebar
            closeSidebar={() => onOpenChange(false)}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};
