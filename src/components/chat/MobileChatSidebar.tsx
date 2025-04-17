
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatSession } from "@/types/chat";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface MobileChatSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatSessions: ChatSession[];
  loadingSessions?: boolean;
  currentSessionId: string | null;
  onSessionLoaded: (sessionId: string) => void;
  onNewSession: () => void;
  isCollapsed?: boolean;
  isCreatingNewSession?: boolean;
  onLastSessionDeleted?: () => void;
}

export const MobileChatSidebar = ({
  open,
  onOpenChange,
  chatSessions,
  loadingSessions = false,
  currentSessionId,
  onSessionLoaded,
  onNewSession,
  isCollapsed = false,
  isCreatingNewSession = false,
  onLastSessionDeleted
}: MobileChatSidebarProps) => {
  // For small to medium screens, use the Drawer component (slides from bottom)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isMobile) {
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
              chatSessions={chatSessions}
              loadingSessions={loadingSessions}
              currentSessionId={currentSessionId}
              onSessionLoaded={onSessionLoaded}
              onNewSession={onNewSession}
              closeSidebar={() => onOpenChange(false)}
              isCollapsed={isCollapsed}
              isCreatingNewSession={isCreatingNewSession}
              onLastSessionDeleted={onLastSessionDeleted}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // For larger screens (tablets in portrait mode), use the Sheet component (slides from left)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="absolute left-2 top-2 z-10 transition-transform duration-200 ease-in-out hover:scale-105"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0">
        <div className="px-4 py-6 h-full flex flex-col overflow-hidden">
          <ChatSidebar
            chatSessions={chatSessions}
            loadingSessions={loadingSessions}
            currentSessionId={currentSessionId}
            onSessionLoaded={onSessionLoaded}
            onNewSession={onNewSession}
            closeSidebar={() => onOpenChange(false)}
            isCollapsed={isCollapsed}
            isCreatingNewSession={isCreatingNewSession}
            onLastSessionDeleted={onLastSessionDeleted}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
