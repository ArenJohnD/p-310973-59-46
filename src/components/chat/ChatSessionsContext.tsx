
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { ChatSession, Message } from "@/types/chat";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { fetchChatSessions, loadChatMessages, createNewSession, setSessionActive } from "@/services/chatService";
import { ChatSessionsContextType } from "./types";

const ChatSessionsContext = createContext<ChatSessionsContextType | undefined>(undefined);

export const useChatSessionsContext = (): ChatSessionsContextType => {
  const context = useContext(ChatSessionsContext);
  if (!context) {
    throw new Error("useChatSessionsContext must be used within a ChatSessionsProvider");
  }
  return context;
};

interface ChatSessionsProviderProps {
  children: ReactNode;
  onSetMessages: (messages: Message[]) => void;
  onSetCurrentSessionId: (sessionId: string | null) => void;
  onSetShowSkeletonMessages: (show: boolean) => void;
  welcomeMessage: Message;
}

export const ChatSessionsProvider = ({ 
  children,
  onSetMessages,
  onSetCurrentSessionId,
  onSetShowSkeletonMessages,
  welcomeMessage
}: ChatSessionsProviderProps) => {
  const { user } = useAuth();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [filteredChatSessions, setFilteredChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [creatingNewSession, setCreatingNewSession] = useState(false);
  const [pendingSession, setPendingSession] = useState<string | null>(null);
  
  const initialSetupDone = useRef(false);
  const sessionsLoaded = useRef(false);

  useEffect(() => {
    if (chatSessions.length === 0) return;

    const filtered = chatSessions.filter(session => {
      if (session.id === currentSessionId || session.title !== "New Chat") {
        return true;
      }
      if (session.id === pendingSession) {
        return true;
      }
      return false;
    });
    
    setFilteredChatSessions(filtered);
  }, [chatSessions, currentSessionId, pendingSession]);

  useEffect(() => {
    if (user) {
      setLoadingHistory(true);
      if (!sessionsLoaded.current) {
        fetchChatSessionsFromServer();
      }
      
      const chatSessionsChannel = supabase
        .channel('chat_sessions_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
          filter: user ? `user_id=eq.${user.id}` : undefined
        }, (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedSessionId = payload.old.id;
            setChatSessions(prev => {
              const updatedSessions = prev.filter(session => session.id !== deletedSessionId);
              
              if (updatedSessions.length === 0 && currentSessionId === deletedSessionId) {
                setCurrentSessionId(null);
                onSetMessages([welcomeMessage]);
                onSetCurrentSessionId(null);
              }
              
              return updatedSessions;
            });
          } else if (payload.eventType === 'INSERT') {
            const newSession = payload.new as ChatSession;
            setChatSessions(prev => [newSession, ...prev.filter(s => s.id !== newSession.id)]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedSession = payload.new as ChatSession;
            setChatSessions(prev => 
              prev.map(session => 
                session.id === updatedSession.id ? updatedSession : session
              )
            );
          }
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(chatSessionsChannel);
      };
    } else {
      onSetMessages([welcomeMessage]);
      setCurrentSessionId(null);
      onSetCurrentSessionId(null);
      setLoadingHistory(false);
    }
  }, [user, welcomeMessage, onSetMessages, onSetCurrentSessionId, currentSessionId]);

  const fetchChatSessionsFromServer = async () => {
    if (!user) return;
    
    try {
      setLoadingHistory(true);
      const sessionData = await fetchChatSessions(user.id);
      
      setChatSessions(sessionData);
      sessionsLoaded.current = true;
      
      if (sessionData.length > 0) {
        const activeSession = sessionData.find(session => session.is_active);
        if (activeSession) {
          setCurrentSessionId(activeSession.id);
          onSetCurrentSessionId(activeSession.id);
          await loadChatMessagesFromServer(activeSession.id, false);
        } else {
          onSetMessages([welcomeMessage]);
          setCurrentSessionId(null);
          onSetCurrentSessionId(null);
        }
      } else {
        onSetMessages([welcomeMessage]);
        setCurrentSessionId(null);
        onSetCurrentSessionId(null);
      }
      
      initialSetupDone.current = true;
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
      toast({
        title: "Error",
        description: "Failed to load chat sessions.",
        variant: "destructive",
      });
      
      onSetMessages([welcomeMessage]);
      initialSetupDone.current = true;
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadChatMessagesFromServer = async (sessionId: string, showLoading = false) => {
    if (!user) return;
    
    try {
      if (showLoading) {
        onSetShowSkeletonMessages(true);
      }
      
      const messageData = await loadChatMessages(sessionId);
      
      if (messageData.length > 0) {
        onSetMessages(messageData);
      } else {
        onSetMessages([welcomeMessage]);
      }
      
      setCurrentSessionId(sessionId);
      onSetCurrentSessionId(sessionId);
      await setSessionActive(user.id, sessionId);
      
      setChatSessions(prev => 
        prev.map(session => ({
          ...session,
          is_active: session.id === sessionId
        }))
      );
    } catch (error) {
      console.error("Error loading chat messages:", error);
      toast({
        title: "Error",
        description: "Failed to load chat messages.",
        variant: "destructive",
      });
      
      onSetMessages([welcomeMessage]);
    } finally {
      setTimeout(() => {
        if (showLoading) {
          onSetShowSkeletonMessages(false);
        }
      }, 300);
    }
  };

  const handleCreateNewSession = async (showLoading = true) => {
    if (!user) return;
    
    try {
      if (showLoading) {
        // setIsLoading(true); - This is handled in the parent component now
      }
      setCreatingNewSession(true);
      
      const newSession = await createNewSession(user.id);
      
      if (newSession) {
        setChatSessions(prev => [newSession, ...prev.map(s => ({ ...s, is_active: false }))]);
        setCurrentSessionId(newSession.id);
        onSetCurrentSessionId(newSession.id);
        
        setPendingSession(newSession.id);
        
        onSetMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error("Error creating new session:", error);
      toast({
        title: "Error",
        description: "Failed to create new chat session.",
        variant: "destructive",
      });
      
      onSetMessages([welcomeMessage]);
    } finally {
      setCreatingNewSession(false);
    }
  };

  const handleSessionLoaded = async (sessionId: string) => {
    await loadChatMessagesFromServer(sessionId, true);
  };
  
  const handleLastSessionDeleted = () => {
    setCurrentSessionId(null);
    onSetCurrentSessionId(null);
    onSetMessages([welcomeMessage]);
  };

  const value: ChatSessionsContextType = {
    chatSessions,
    filteredChatSessions,
    currentSessionId,
    loadingHistory,
    creatingNewSession,
    pendingSession,
    handleSessionLoaded,
    handleCreateNewSession,
    handleLastSessionDeleted
  };

  return <ChatSessionsContext.Provider value={value}>{children}</ChatSessionsContext.Provider>;
};
