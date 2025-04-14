
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { ChatContextType } from "./types";
import { Message, ReferenceDocument } from "@/types/chat";
import { findRelevantInformation, saveMessage, generateChatTitle, updateSessionTitle } from "@/services/chatService";
import { fetchReferenceDocuments } from "@/services/chatService";

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatContextProvider");
  }
  return context;
};

interface ChatContextProviderProps {
  children: ReactNode;
  sessionId: string | null;
  onUpdateSessionTitle: (sessionId: string, title: string) => void;
  pendingSession: string | null;
  onClearPendingSession: (sessionId: string | null) => void;
}

export const ChatContextProvider = ({ 
  children, 
  sessionId,
  onUpdateSessionTitle,
  pendingSession,
  onClearPendingSession
}: ChatContextProviderProps) => {
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
  const [showTypingMessage, setShowTypingMessage] = useState(false);

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
  }, []);

  const sendMessage = async (inputText: string) => {
    if (!inputText.trim() || !user || !sessionId) return;
    
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
      await saveMessage(sessionId, userMessage.text, "user");
      
      const botResponse = await findRelevantInformation(inputText, referenceDocuments);
      
      // Generate title for new sessions after first user message
      if (pendingSession === sessionId) {
        const title = await generateChatTitle(inputText, botResponse);
        await updateSessionTitle(sessionId, title);
        onUpdateSessionTitle(sessionId, title);
        onClearPendingSession(sessionId);
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

  const value: ChatContextType = {
    messages,
    isLoading,
    sendMessage,
    showTypingMessage,
    referenceDocuments,
    currentSessionId: sessionId
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
