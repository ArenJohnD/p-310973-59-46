
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Message } from "@/types/chat";
import { ChatSidebar } from "./chat/ChatSidebar";
import { MobileChatSidebar } from "./chat/MobileChatSidebar";
import { MessageBubble } from "./chat/MessageBubble";
import { TypingIndicator } from "./chat/TypingIndicator";
import { ChatInput } from "./chat/ChatInput";
import { ChatContainer } from "./chat/ChatContainer";
import { ChatBotProps } from "./chat/types";
import { ChatContextProvider } from "./chat/ChatContext";
import { ChatSessionsProvider } from "./chat/ChatSessionsContext";
import "./ChatBot.css";

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
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSkeletonMessages, setShowSkeletonMessages] = useState(false);
  
  // Using useRef for the visibility change timeout
  const visibilityChangeTimeout = useRef<number | null>(null);

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
  }, []);

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

  const handleUpdateSessionTitle = (sessionId: string, title: string) => {
    // Update local chat sessions with new title
    // This will be handled by the ChatSessionsContext
  };

  const handleClearPendingSession = (sessionId: string | null) => {
    // Clear pending session - will be handled in ChatSessionsContext
  };

  return (
    <div className={`flex flex-col bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)] border border-[rgba(0,0,0,0.2)] rounded-[30px] p-4 w-full ${isMaximized ? 'h-full' : 'max-w-[1002px] mx-auto'}`}>
      <ChatSessionsProvider
        onSetMessages={setMessages}
        onSetCurrentSessionId={setCurrentSessionId}
        onSetShowSkeletonMessages={setShowSkeletonMessages}
        welcomeMessage={welcomeMessage}
      >
        {user ? (
          <div className={`flex ${isMaximized ? 'h-full' : 'h-[450px]'} relative`}>
            {isMobile && (
              <MobileChatSidebar
                open={sidebarOpen}
                onOpenChange={setSidebarOpen}
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
                    isCollapsed={isCollapsed}
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
            
            <ChatContextProvider 
              sessionId={currentSessionId}
              onUpdateSessionTitle={handleUpdateSessionTitle}
              pendingSession={null}
              onClearPendingSession={handleClearPendingSession}
            >
              <ChatContainer
                loadingHistory={false}
                isMobile={isMobile}
                isMaximized={isMaximized}
                showSkeletonMessages={showSkeletonMessages}
              />
            </ChatContextProvider>
          </div>
        ) : (
          <div className={isMaximized ? 'h-full' : ''}>
            <ScrollArea className={isMaximized ? 'h-[80vh]' : 'h-[350px]'}>
              <div className="flex flex-col gap-4 p-2">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            </ScrollArea>
            
            <ChatInput 
              onSendMessage={() => {}} 
              isLoading={false} 
              disabled={!user}
            />
          </div>
        )}
      </ChatSessionsProvider>
    </div>
  );
};
