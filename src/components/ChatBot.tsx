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
import { Message, ReferenceDocument, ChatSession, Citation, DocumentSection } from "@/types/chat";
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
import { extractTextFromPDF, extractDocumentSections } from "@/utils/pdfUtils";
import { findBestMatch } from "@/utils/searchUtils";
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
  const [citations, setCitations] = useState<Record<string, Citation[]>>({});

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

  const findRelevantInformationWithCitations = async (query: string, referenceDocuments: ReferenceDocument[]): Promise<{ text: string, citations: Citation[] }> => {
    console.log("Finding relevant information for query:", query);
    console.log("Reference documents available:", referenceDocuments.length);
    
    if (referenceDocuments.length === 0) {
      try {
        console.log("No reference documents found, using DeepSeek API directly");
        const { data, error } = await supabase.functions.invoke('deepseek-chat', {
          body: { query, context: "" }
        });

        if (error) throw new Error(error.message);
        
        return { 
          text: data.answer,
          citations: data.citations || []
        };
      } catch (err) {
        console.error("Error calling DeepSeek API:", err);
        return { 
          text: "I'm sorry, I encountered an error while processing your question. Please try again later.",
          citations: []
        };
      }
    }

    try {
      const allSections: DocumentSection[] = [];
      const documentInfo = {};
      
      for (const doc of referenceDocuments) {
        try {
          console.log(`Processing document: ${doc.file_name}`);
          
          // Get a signed URL for the document
          const { data: fileData } = await supabase.storage
            .from('policy_documents')
            .createSignedUrl(doc.file_path, 3600);
            
          if (!fileData?.signedUrl) {
            console.error(`Could not get signed URL for ${doc.file_path}`);
            continue;
          }
          
          // Extract text from the PDF
          const text = await extractTextFromPDF(fileData.signedUrl);
          console.log(`Extracted text length: ${text.length} characters from ${doc.file_name}`);
          
          // Extract sections from the text with position information
          const sections = extractDocumentSections(text, doc.id, doc.file_name);
          
          // Add sections to document info for citation references
          sections.forEach(section => {
            if (section.articleNumber) {
              documentInfo[`article ${section.articleNumber}`] = {
                documentId: doc.id,
                position: section.position,
                fileName: doc.file_name
              };
            }
            
            if (section.sectionId) {
              documentInfo[`section ${section.sectionId}`] = {
                documentId: doc.id,
                position: section.position,
                fileName: doc.file_name
              };
            }
          });
          
          allSections.push(...sections);
          console.log(`Extracted ${sections.length} sections from ${doc.file_name}`);
        } catch (err) {
          console.error(`Error processing document ${doc.file_name}:`, err);
        }
      }
      
      console.log(`Total sections available: ${allSections.length}`);
      
      if (allSections.length === 0) {
        return {
          text: "I don't have any information from policy documents yet. Please upload some documents so I can provide more accurate responses.",
          citations: []
        };
      }
      
      const bestMatches = findBestMatch(query, allSections);
      
      if (bestMatches.length > 0) {
        console.log(`Found ${bestMatches.length} relevant sections`);
        
        const context = bestMatches
          .map(match => `${match.title}\n${match.content}`)
          .join('\n\n');
        
        console.log("Context length: ", context.length);
        console.log("Sending query to DeepSeek with context");
        
        try {
          const { data, error } = await supabase.functions.invoke('deepseek-chat', {
            body: { query, context, documentInfo }
          });

          if (error) throw new Error(error.message);
          
          return { 
            text: data.answer,
            citations: data.citations || [] 
          };
        } catch (err) {
          console.error("Error calling DeepSeek API with context:", err);
          
          return { 
            text: `Based on the policy documents, here's what I found:\n\n${bestMatches[0].content}`,
            citations: []
          };
        }
      } else {
        console.log("No specific matches found. Using general context");
        
        const generalContext = allSections
          .slice(0, 5)
          .map(section => `${section.title}\n${section.content}`)
          .join('\n\n');
          
        try {
          const { data, error } = await supabase.functions.invoke('deepseek-chat', {
            body: { query, context: generalContext, documentInfo }
          });

          if (error) throw new Error(error.message);
          
          return { 
            text: data.answer,
            citations: data.citations || []
          };
        } catch (err) {
          console.error("Error calling DeepSeek API with general context:", err);
          return {
            text: "I couldn't find specific information about this in the policy documents. Please check the university handbook or ask an administrator.",
            citations: []
          };
        }
      }
    } catch (error) {
      console.error("Error searching reference documents:", error);
      return {
        text: "I encountered an error while searching the policy documents. Please try again later.",
        citations: []
      };
    }
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
      
      const response = await findRelevantInformationWithCitations(inputText, referenceDocuments);
      
      // Store citations for this message
      if (response.citations && response.citations.length > 0) {
        setCitations(prev => ({
          ...prev,
          [sessionId]: response.citations
        }));
      }
      
      const currentMessages = await loadChatMessages(sessionId);
      const userMessages = currentMessages.filter(m => m.sender === "user");
      
      if (userMessages.length <= 1) {
        const title = await generateChatTitle(inputText, response.text);
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
        text: response.text,
        sender: "bot",
        timestamp: new Date()
      };
      
      setShowTypingMessage(false);
      setMessages(prev => [...prev, botMessage]);
      
      await saveMessage(sessionId, response.text, "bot");
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

  const handleCitationClick = (citation: Citation) => {
    if (citation.documentId && citation.position) {
      window.open(`/policy-viewer/${citation.documentId}?page=${citation.position.startPage}&highlight=true`, '_blank');
    }
  };

  const handleSessionLoaded = async (sessionId: string) => {
    await loadChatMessagesFromServer(sessionId, true);
  };

  const handleCreateNewSession = async () => {
    if (!user) return;
    
    try {
      setCreatingNewSession(true);
      
      const newSession = await createNewSession(user.id);
      
      if (newSession) {
        setCurrentSessionId(newSession.id);
        setChatSessions(prev => [newSession, ...prev.map(s => ({ ...s, is_active: false }))]);
        setMessages([welcomeMessage]);
        setPendingSession(newSession.id);
      } else {
        toast({
          title: "Error",
          description: "Failed to create chat session. Please log in and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating new session:", error);
      toast({
        title: "Error",
        description: "Failed to create new chat session.",
        variant: "destructive",
      });
    } finally {
      setCreatingNewSession(false);
    }
  };

  const handleLastSessionDeleted = () => {
    setCurrentSessionId(null);
    setMessages([welcomeMessage]);
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
                  <MessageBubble 
                    key={message.id} 
                    message={message} 
                    citations={currentSessionId ? citations[currentSessionId] : []}
                    onCitationClick={handleCitationClick}
                  />
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
