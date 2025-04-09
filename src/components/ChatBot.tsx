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
import "./ChatBot.css";

GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface ChatBotProps {
  isMaximized?: boolean;
}

export const ChatBot = ({ isMaximized = false }: ChatBotProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome",
    text: "Hi! I'm Poli, your NEU policy assistant. I can help you find information about university policies, answer questions about academic regulations, and guide you through administrative procedures. How can I assist you today?",
    sender: "bot",
    timestamp: new Date()
  }]);
  const [isLoading, setIsLoading] = useState(false);
  const [referenceDocuments, setReferenceDocuments] = useState<ReferenceDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showTypingMessage, setShowTypingMessage] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  useEffect(() => {
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
      fetchChatSessionsFromServer();
      
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
            setChatSessions(prev => prev.filter(session => session.id !== deletedSessionId));
            
            if (deletedSessionId === currentSessionId) {
              const remainingSessions = chatSessions.filter(session => session.id !== deletedSessionId);
              if (remainingSessions.length > 0) {
                setCurrentSessionId(remainingSessions[0].id);
                loadChatMessagesFromServer(remainingSessions[0].id);
              } else {
                handleCreateNewSession();
              }
            }
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
    }
  }, [user]);

  const fetchChatSessionsFromServer = async () => {
    if (!user) return;
    
    try {
      setLoadingSessions(true);
      
      const sessionData = await fetchChatSessions(user.id);
      
      if (sessionData.length > 0) {
        setChatSessions(sessionData);
        
        const activeSession = sessionData.find(session => session.is_active);
        if (activeSession) {
          setCurrentSessionId(activeSession.id);
          await loadChatMessagesFromServer(activeSession.id);
        } else {
          await handleCreateNewSession();
        }
      } else {
        await handleCreateNewSession();
      }
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
      toast({
        title: "Error",
        description: "Failed to load chat sessions.",
        variant: "destructive",
      });
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadChatMessagesFromServer = async (sessionId: string) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      const messageData = await loadChatMessages(sessionId);
      
      if (messageData.length > 0) {
        setMessages(messageData);
      } else {
        setMessages([{
          id: "welcome",
          text: "Hi! I'm Poli, your NEU policy assistant. I can help you find information about university policies, answer questions about academic regulations, and guide you through administrative procedures. How can I assist you today?",
          sender: "bot",
          timestamp: new Date()
        }]);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewSession = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      const newSession = await createNewSession(user.id);
      
      if (newSession) {
        setChatSessions(prev => [newSession, ...prev.map(s => ({ ...s, is_active: false }))]);
        setCurrentSessionId(newSession.id);
        
        setMessages([{
          id: "welcome",
          text: "Hi! I'm Poli, your NEU policy assistant. I can help you find information about university policies, answer questions about academic regulations, and guide you through administrative procedures. How can I assist you today?",
          sender: "bot",
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error("Error creating new session:", error);
      toast({
        title: "Error",
        description: "Failed to create new chat session.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      if (isMobile) {
        setSidebarOpen(false);
      }
    }
  };

  const handleSessionLoaded = async (sessionId: string) => {
    await loadChatMessagesFromServer(sessionId);
  };

  const handleSendMessage = async (inputText: string) => {
    if (!inputText.trim() || !user) return;
    
    if (!currentSessionId) {
      await handleCreateNewSession();
      if (!currentSessionId) {
        toast({
          title: "Error",
          description: "Failed to create chat session. Please log in and try again.",
          variant: "destructive",
        });
        return;
      }
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: "user",
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setShowTypingMessage(true);
    
    try {
      await saveMessage(currentSessionId, userMessage.text, "user");
      
      const currentMessages = messages.filter(m => m.sender === "user");
      if (currentMessages.length === 0) {
        const title = await generateChatTitle(inputText);
        await updateSessionTitle(currentSessionId, title);
        setChatSessions(prev => 
          prev.map(session => 
            session.id === currentSessionId ? { ...session, title } : session
          )
        );
      }
      
      const botResponse = await findRelevantInformation(inputText, referenceDocuments);
      
      const title = await generateChatTitle(inputText, botResponse);
      await updateSessionTitle(currentSessionId, title);
      setChatSessions(prev => 
        prev.map(session => 
          session.id === currentSessionId ? { ...session, title } : session
        )
      );
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: "bot",
        timestamp: new Date()
      };
      
      setShowTypingMessage(false);
      setMessages(prev => [...prev, botMessage]);
      
      await saveMessage(currentSessionId, botResponse, "bot");
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

  return (
    <div className={`flex flex-col bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)] border border-[rgba(0,0,0,0.2)] rounded-[30px] p-4 w-full ${isMaximized ? 'h-full' : 'max-w-[1002px] mx-auto'}`}>
      {user ? (
        <div className={`flex ${isMaximized ? 'h-full' : 'h-[450px]'} relative`}>
          {isMobile && (
            <MobileChatSidebar
              open={sidebarOpen}
              onOpenChange={setSidebarOpen}
              chatSessions={chatSessions}
              loadingSessions={loadingSessions}
              currentSessionId={currentSessionId}
              onSessionLoaded={handleSessionLoaded}
              onNewSession={handleCreateNewSession}
              isCollapsed={isCollapsed}
            />
          )}
          
          {!isMobile && (
            <Collapsible
              open={!isCollapsed}
              onOpenChange={(open) => setIsCollapsed(!open)}
              className="relative group"
            >
              <div className={`h-full bg-white border-r border-gray-200 transition-all ${isCollapsed ? 'w-0 overflow-hidden' : 'w-64'}`}>
                <ChatSidebar
                  chatSessions={chatSessions}
                  loadingSessions={loadingSessions}
                  currentSessionId={currentSessionId}
                  onSessionLoaded={handleSessionLoaded}
                  onNewSession={handleCreateNewSession}
                  isCollapsed={isCollapsed}
                />
              </div>
              
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute -right-4 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full border shadow-sm z-10 bg-white"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="flex-1">
                {/* Content appears here when sidebar is collapsed */}
              </CollapsibleContent>
            </Collapsible>
          )}
          
          <div className={`flex-1 flex flex-col relative h-full ${isMobile ? 'pt-10' : ''}`}>
            <ScrollArea ref={scrollAreaRef} className={`flex-1 w-full ${isMobile ? 'pt-10' : ''} px-2`}>
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
        </div>
      ) : (
        <div className={isMaximized ? 'h-full' : ''}>
          <ScrollArea ref={scrollAreaRef} className={isMaximized ? 'h-[80vh]' : 'h-[350px]'}>
            <div className="flex flex-col gap-4 p-2">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
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
