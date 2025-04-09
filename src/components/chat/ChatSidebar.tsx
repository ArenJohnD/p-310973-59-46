
import { useState } from "react";
import { MessageSquare, Trash2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { ChatSession } from "@/types/chat";
import { deleteSession, loadChatMessages, createNewSession } from "@/services/chatService";

interface ChatSidebarProps {
  chatSessions: ChatSession[];
  loadingSessions: boolean;
  currentSessionId: string | null;
  onSessionLoaded: (sessionId: string) => void;
  onNewSession: () => void;
  closeSidebar?: () => void;
  isCollapsed?: boolean;
}

export const ChatSidebar = ({
  chatSessions,
  loadingSessions,
  currentSessionId,
  onSessionLoaded,
  onNewSession,
  closeSidebar,
  isCollapsed = false
}: ChatSidebarProps) => {
  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await deleteSession(sessionId);
      
      toast({
        title: "Success",
        description: "Chat session deleted successfully.",
      });
      
      if (sessionId === currentSessionId && chatSessions.length > 1) {
        const remainingSessions = chatSessions.filter(session => session.id !== sessionId);
        if (remainingSessions.length > 0) {
          onSessionLoaded(remainingSessions[0].id);
        }
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      toast({
        title: "Error",
        description: "Failed to delete chat session.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-semibold">Your Chats</h2>
      </div>
      
      <ScrollArea className="h-[calc(100%-130px)] overflow-auto">
        {loadingSessions ? (
          <div className="flex justify-center items-center h-20">
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          </div>
        ) : chatSessions.length === 0 ? (
          <div className="text-center text-gray-500 py-8 px-4">
            <p>No chat history found</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {chatSessions.map((session) => (
              <div 
                key={session.id} 
                className="group/menu-item relative flex items-center justify-between"
              >
                <button
                  className={`flex-1 truncate text-left rounded-md px-3 py-2 mx-2 ${
                    currentSessionId === session.id
                      ? "bg-green-100 text-green-900"
                      : "hover:bg-gray-100"
                  }`}
                  onClick={() => {
                    onSessionLoaded(session.id);
                    if (closeSidebar) closeSidebar();
                  }}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{session.title}</span>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  className="h-6 w-6 rounded-full opacity-0 transition-opacity group-hover/menu-item:opacity-100 flex-shrink-0 absolute right-2"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      
      {!isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              onNewSession();
              if (closeSidebar) closeSidebar();
            }}
            className="w-full flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" /> New Chat
          </Button>
        </div>
      )}
    </>
  );
};
