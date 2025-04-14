
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Plus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { GlobalWorkerOptions } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';
import { Message, ReferenceDocument, ChatSession } from "@/types/chat";
import { 
  fetchChatSessions, 
  loadChatMessages, 
  createNewSession, 
  setSessionActive,
  findRelevantInformation,
  generateChatTitle,
  fetchReferenceDocuments,
  saveMessage,
  updateSessionTitle
} from "@/services/chatService";
import { ChatSidebar } from "./chat/ChatSidebar";
import { MobileChatSidebar } from "./chat/MobileChatSidebar";
import { MessageBubble } from "./chat/MessageBubble";
import { TypingIndicator } from "./chat/TypingIndicator";
import { ChatInput } from "./chat/ChatInput";
import { AutoScrollButton } from "./chat/AutoScrollButton";
import { MessageSkeleton } from "./chat/MessageSkeleton";
import "./ChatBot.css";

GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface ChatBotProps {
  isMaximized?: boolean;
}

export const ChatBot = ({ isMaximized = false }: ChatBotProps) => {
  const { user } = useAuth();
  const welcomeMessage: Message = {
    id: "welcome",
    text: "Hi! I'm Poli, your NEU policy assistant. I can help you find information about university policies, answer questions about academic regulations, and guide you through administrative procedures. How can I assist you today?",
    sender: "bot",
    timestamp: new Date()
  };
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [isLoading, setIsLoading] = useState(false);
  const [referenceDocuments, setReferenceDocuments] = useState<ReferenceDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [filteredChatSessions, setFilteredChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showTypingMessage, setShowTypingMessage] = useState(false);
  const [creatingNewSession, setCreatingNewSession] = useState(false);
  const [pendingSession, setPendingSession] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const [showSkeletonMessages, setShowSkeletonMessages] = useState(false);
  
  // Change from useState to useRef for the visibility change timeout
  const visibilityChangeTimeout = useRef<number | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const initialSetupDone = useRef(false);
  const sessionsLoaded = useRef(false);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (visibilityChangeTimeout.current) {
          clearTimeout(visibilityChangeTimeout.current);
        }
      } else if (document.visibilityState === 'visible') {
        visibilityChangeTimeout.current = window.setTimeout(() => {
          setShowSkeletonMessages(false);
          setIsLoading(false);
          setShowTypingMessage(false);
          
          if (loadingHistory) {
            setLoadingHistory(false);
          }
          
          visibilityChangeTimeout.current = null;
        }, 300);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityChangeTimeout.current) {
        clearTimeout(visibilityChangeTimeout.current);
      }
    };
  }, [loadingHistory]);

  useEffect(() => {
    if (scrollAreaRef.current && !isUserScrolled) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        setHasNewMessages(false);
      }
    } else if (isUserScrolled && messages.length > 0) {
      setHasNewMessages(true);
    }
  }, [messages, isUserScrolled]);

  const handleScrollAreaScroll = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
        setIsUserScrolled(!isAtBottom);
        
        if (isAtBottom) {
          setHasNewMessages(false);
        }
      }
    }
  };

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        setHasNewMessages(false);
        setIsUserScrolled(false);
      }
    }
  };

  useEffect(() => {
    setLoadingDocuments(true);
    fetchReferenceDocuments()
      .then(documents => setReferenceDocuments(documents))
      .catch(error => {
        console.error("Error fetching reference documents:", error);
        toast({
          title: "Error",
          description: "Failed to load reference documents",
          variant: "destructive",
        });
      })
      .finally(() => setLoadingDocuments(false));
    
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
                setMessages([welcomeMessage]);
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
      setMessages([welcomeMessage]);
      setCurrentSessionId(null);
      setLoadingHistory(false);
    }
  }, [user]);

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
          await loadChatMessagesFromServer(activeSession.id, false);
        } else {
          setMessages([welcomeMessage]);
          setCurrentSessionId(null);
        }
      } else {
        setMessages([welcomeMessage]);
        setCurrentSessionId(null);
      }
      
      initialSetupDone.current = true;
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
      toast({
        title: "Error",
        description: "Failed to load chat sessions.",
        variant: "destructive",
      });
      
      setMessages([welcomeMessage]);
      initialSetupDone.current = true;
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadChatMessagesFromServer = async (sessionId: string, showLoading = false) => {
    if (!user) return;
    
    try {
      if (showLoading) {
        setShowSkeletonMessages(true);
      }
      
      const messageData = await loadChatMessages(sessionId);
      
      if (messageData.length > 0) {
        setMessages(messageData);
      } else {
        setMessages([welcomeMessage]);
      }
      
      setCurrentSessionId(sessionId);
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
      
      setMessages([welcomeMessage]);
    } finally {
      setTimeout(() => {
        if (showLoading) {
          setShowSkeletonMessages(false);
        }
      }, 300);
    }
  };

  const handleCreateNewSession = async (showLoading = true) => {
    if (!user) return;
    
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setCreatingNewSession(true);
      
      const newSession = await createNewSession(user.id);
      
      if (newSession) {
        setChatSessions(prev => [newSession, ...prev.map(s => ({ ...s, is_active: false }))]);
        setCurrentSessionId(newSession.id);
        
        setPendingSession(newSession.id);
        
        setMessages([welcomeMessage]);
        scrollToBottom();
      }
    } catch (error) {
      console.error("Error creating new session:", error);
      toast({
        title: "Error",
        description: "Failed to create new chat session.",
        variant: "destructive",
      });
      
      setMessages([welcomeMessage]);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
      setCreatingNewSession(false);
      if (isMobile) {
        setSidebarOpen(false);
      }
    }
  };

  const handleSessionLoaded = async (sessionId: string) => {
    await loadChatMessagesFromServer(sessionId, true);
    setIsUserScrolled(false);
    scrollToBottom();
  };
  
  const handleLastSessionDeleted = () => {
    setCurrentSessionId(null);
    setMessages([welcomeMessage]);
  };

  const handleSendMessage = async (inputText: string) => {
    if (!inputText.trim() || !user) return;
    
    let sessionId = currentSessionId;
    
    if (!sessionId) {
      try {
        setIsLoading(true);
        setCreatingNewSession(true);
        
        const newSession = await createNewSession(user.id);
        
        if (newSession) {
          sessionId = newSession.id;
          setCurrentSessionId(sessionId);
          setChatSessions(prev => [newSession, ...prev.map(s => ({ ...s, is_active: false }))]);
          
          setPendingSession(newSession.id);
        } else {
          toast({
            title: "Error",
            description: "Failed to create chat session. Please log in and try again.",
            variant: "destructive",
          });
          return;
        }
      } catch (error) {
        console.error("Error creating new session:", error);
        toast({
          title: "Error",
          description: "Failed to create new chat session.",
          variant: "destructive",
        });
        return;
      } finally {
        setCreatingNewSession(false);
      }
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: "user",
      timestamp: new Date()
    };
    
    setIsUserScrolled(false);
    scrollToBottom();
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setShowTypingMessage(true);
    
    try {
      await saveMessage(sessionId, userMessage.text, "user");
      
      const botResponse = await findRelevantInformation(inputText, referenceDocuments);
      
      const currentMessages = await loadChatMessages(sessionId);
      const userMessages = currentMessages.filter(m => m.sender === "user");
      
      if (userMessages.length <= 1) {
        const title = await generateChatTitle(inputText, botResponse);
        await updateSessionTitle(sessionId, title);
        setChatSessions(prev => 
          prev.map(session => 
            session.id === sessionId ? { ...session, title } : session
          )
        );
        
        if (pendingSession === sessionId) {
          setPendingSession(null);
        }
      }
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: "bot",
        timestamp: new Date()
      };
      
      setShowTypingMessage(false);
      setMessages(prev => [...prev, botMessage]);
      
      await saveMessage(sessionId, botResponse, "bot");
    } catch (error) {
      console.error("Error generating response:", error);
      toast({
        title: "Error",
        description: "Failed to generate a response. Please try again.",
        variant: "destructive",
      });
      
      setShowTypingMessage(false);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I encountered an error while processing your question. Please try again later.",
        sender: "bot",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const textArea = document.querySelector('textarea[name="message"]') as HTMLTextAreaElement;
        if (textArea && textArea.value.trim()) {
          const sendButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
          if (sendButton) {
            sendButton.click();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className={`flex flex-col bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)] border border-[rgba(0,0,0,0.2)] rounded-[30px] p-4 w-full ${isMaximized ? 'h-full' : 'max-w-[1002px] mx-auto'}`}>
      {user ? (
        <div className={`flex ${isMaximized ? 'h-full' : 'h-[450px]'} relative`}>
          {isMobile && (
            <MobileChatSidebar
              open={sidebarOpen}
              onOpenChange={setSidebarOpen}
              chatSessions={filteredChatSessions}
              currentSessionId={currentSessionId}
              onSessionLoaded={handleSessionLoaded}
              onNewSession={handleCreateNewSession}
              isCollapsed={isCollapsed}
              isCreatingNewSession={creatingNewSession}
              loadingSessions={loadingHistory}
              onLastSessionDeleted={handleLastSessionDeleted}
            />
          )}
          
          {!isMobile && (
            <Collapsible
              open={!isCollapsed}
              onOpenChange={(open) => setIsCollapsed(!open)}
              className="relative group"
            >
              <div className={`h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 overflow-hidden' : 'w-64'}`}>
                <ChatSidebar
                  chatSessions={filteredChatSessions}
                  currentSessionId={currentSessionId}
                  onSessionLoaded={handleSessionLoaded}
                  onNewSession={handleCreateNewSession}
                  isCollapsed={isCollapsed}
                  isCreatingNewSession={creatingNewSession}
                  loadingSessions={loadingHistory}
                  onLastSessionDeleted={handleLastSessionDeleted}
                />
              </div>
              
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute -right-4 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full border shadow-sm z-10 bg-white transition-transform duration-300 ease-in-out hover:bg-gray-100"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 transition-transform duration-300 ease-in-out" />
                  ) : (
                    <ChevronLeft className="h-4 w-4 transition-transform duration-300 ease-in-out" />
                  )}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="flex-1">
                {/* Content appears here when sidebar is collapsed */}
              </CollapsibleContent>
            </Collapsible>
          )}
          
          <div className={`flex-1 flex flex-col relative h-full ${isMobile ? 'pt-10' : ''}`}>
            <ScrollArea 
              ref={scrollAreaRef} 
              className={`flex-1 w-full ${isMobile ? 'pt-10' : ''} px-2`}
              onScrollCapture={handleScrollAreaScroll}
            >
              <div className="flex flex-col gap-4 p-2">
                {loadingHistory && (
                  <>
                    <MessageSkeleton type="bot" />
                    <MessageSkeleton type="user" />
                    <MessageSkeleton type="bot" />
                  </>
                )}
                
                {!loadingHistory && messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                
                {showSkeletonMessages && (
                  <MessageSkeleton type="bot" />
                )}
                
                {showTypingMessage && <TypingIndicator />}
              </div>
            </ScrollArea>
            
            {hasNewMessages && (
              <AutoScrollButton onClick={scrollToBottom} className="z-10" />
            )}
            
            <ChatInput 
              onSendMessage={handleSendMessage} 
              isLoading={isLoading} 
              disabled={!user}
            />
          </div>
        </div>
      ) : (
        <div className={isMaximized ? 'h-full' : ''}>
          <ScrollArea ref={scrollAreaRef} className={isMaximized ? 'h-[80vh]' : 'h-[350px]'}>
            <div className="flex flex-col gap-4 p-2">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {showTypingMessage && <TypingIndicator />}
            </div>
          </ScrollArea>
          
          <ChatInput 
            onSendMessage={handleSendMessage} 
            isLoading={isLoading} 
            disabled={!user}
          />
        </div>
      )}
    </div>
  );
};
