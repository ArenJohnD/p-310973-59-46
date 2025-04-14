
import { useState, useRef, useEffect } from "react";
import { MessageSquare, Trash2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { ChatSession } from "@/types/chat";
import { deleteSession } from "@/services/chatService";
import { Skeleton } from "@/components/ui/skeleton";
import { useChatSessionsContext } from "./ChatSessionsContext";

interface ChatSidebarProps {
  closeSidebar?: () => void;
  isCollapsed?: boolean;
}

export const ChatSidebar = ({
  closeSidebar,
  isCollapsed = false,
}: ChatSidebarProps) => {
  const { 
    filteredChatSessions,
    currentSessionId,
    loadingHistory,
    creatingNewSession,
    handleSessionLoaded,
    handleCreateNewSession,
    handleLastSessionDeleted
  } = useChatSessionsContext();
  
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [localSessions, setLocalSessions] = useState<ChatSession[]>([]);
  const deletedSessionIds = useRef(new Set<string>());

  // Update local sessions when chatSessions prop changes, but maintain any deletions in progress
  useEffect(() => {
    if (filteredChatSessions.length === 0 && loadingHistory) {
      setLocalSessions([
        { id: 'placeholder-1', title: 'Loading...', user_id: '', created_at: new Date().toISOString(), is_active: true } as ChatSession,
        { id: 'placeholder-2', title: 'Loading...', user_id: '', created_at: new Date().toISOString(), is_active: false } as ChatSession,
      ]);
      return;
    }
    
    // Deduplicate sessions by ID before setting local state
    const uniqueSessions = Array.from(
      new Map(filteredChatSessions.map(session => [session.id, session])).values()
    ).filter(session => !deletedSessionIds.current.has(session.id));
    
    setLocalSessions(prevSessions => {
      // If there's a session being deleted, make sure it's excluded
      if (deletingSessionId) {
        return uniqueSessions.filter(session => session.id !== deletingSessionId);
      }
      
      return uniqueSessions;
    });
  }, [filteredChatSessions, deletingSessionId, loadingHistory]);

  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Check if this is the last session before deletion
    const isLastSession = localSessions.length <= 1;
    
    // Mark this session as being deleted (for animation)
    setDeletingSessionId(sessionId);
    
    // Add to our local set of deleted session IDs to prevent re-appearance
    deletedSessionIds.current.add(sessionId);
    
    // Update local state immediately for responsive UI
    setLocalSessions(prev => prev.filter(session => session.id !== sessionId));
    
    try {
      // Actual deletion in the background
      await deleteSession(sessionId);
      
      // If this was the last session, trigger the callback to show welcome message
      if (isLastSession && handleLastSessionDeleted) {
        handleLastSessionDeleted();
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      toast({
        title: "Error",
        description: "Failed to delete chat session.",
        variant: "destructive",
      });
      
      // If deletion failed, remove from our deleted set
      deletedSessionIds.current.delete(sessionId);
      
      // Restore the session in UI
      setLocalSessions(prev => {
        const sessionToRestore = filteredChatSessions.find(s => s.id === sessionId);
        if (sessionToRestore && !prev.some(s => s.id === sessionId)) {
          return [...prev, sessionToRestore];
        }
        return prev;
      });
    } finally {
      setDeletingSessionId(null);
    }
  };

  const renderSessionItem = (session: ChatSession) => {
    const isPlaceholder = session.id.startsWith('placeholder-');
    
    if (isPlaceholder) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 mx-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      );
    }
    
    return (
      <div 
        key={session.id} 
        className={`
          group/menu-item relative flex items-center justify-between
          transition-all duration-300 ease-in-out
          ${deletingSessionId === session.id ? 'opacity-0 h-0 scale-0 m-0 p-0 transform-gpu' : 'opacity-100 transform-gpu'}
        `}
      >
        <button
          className={`flex-1 truncate text-left rounded-md px-3 py-2 mx-2 transition-colors duration-200 ${
            currentSessionId === session.id
              ? "bg-green-100 text-green-900"
              : "hover:bg-gray-100"
          }`}
          onClick={() => {
            handleSessionLoaded(session.id);
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
          disabled={deletingSessionId === session.id || localSessions.length === 0}
        >
          {deletingSessionId === session.id ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </Button>
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-semibold">Your Chats</h2>
      </div>
      
      <ScrollArea className="h-[calc(100%-130px)] overflow-auto">
        {loadingHistory && localSessions.length === 0 ? (
          <div className="flex justify-center items-center h-20">
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          </div>
        ) : localSessions.length === 0 ? (
          <div className="text-center text-gray-500 py-8 px-4">
            <p>No chat history yet</p>
            <p className="text-sm mt-2">Start a new conversation</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {localSessions.map((session) => renderSessionItem(session))}
          </div>
        )}
      </ScrollArea>
      
      {!isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              handleCreateNewSession();
              if (closeSidebar) closeSidebar();
            }}
            className="w-full flex items-center justify-center gap-2"
            disabled={creatingNewSession}
          >
            {creatingNewSession ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Plus className="h-4 w-4" />
            )} 
            New Chat
          </Button>
        </div>
      )}
    </>
  );
};
