
import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Maximize, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Message } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasDocuments, setHasDocuments] = useState<boolean | null>(null);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Hello! I'm your AI assistant. I can answer questions based on the reference documents that have been uploaded. How can I help you today?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);

  // Check if reference documents exist when chat is opened
  useEffect(() => {
    if (isOpen && hasDocuments === null) {
      checkForDocuments();
    }
  }, [isOpen]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const checkForDocuments = async () => {
    try {
      const { count, error } = await supabase
        .from('reference_documents')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      
      setHasDocuments(count ? count > 0 : false);
      
      if (!count || count === 0) {
        setMessages(prev => [
          ...prev,
          {
            id: "no-docs",
            text: "No reference documents have been uploaded yet. Please ask an administrator to upload documents so I can assist you better.",
            sender: "bot",
            timestamp: new Date(),
          }
        ]);
      }
    } catch (error) {
      console.error('Error checking for documents:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Add typing indicator
      setMessages(prev => [...prev, {
        id: "typing",
        text: "...",
        sender: "bot",
        timestamp: new Date(),
      }]);

      const { data, error } = await supabase.functions.invoke('mistral-chat', {
        body: {
          messages: messages.concat(userMessage).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          }))
        }
      });

      if (error) throw error;

      // Remove typing indicator and add actual response
      setMessages((prev) => {
        const filtered = prev.filter(msg => msg.id !== "typing");
        return [...filtered, {
          id: (Date.now() + 1).toString(),
          text: data.answer,
          sender: "bot",
          timestamp: new Date(),
        }];
      });

    } catch (error) {
      console.error('Chat error:', error);
      
      // Remove typing indicator
      setMessages((prev) => {
        const filtered = prev.filter(msg => msg.id !== "typing");
        return [...filtered, {
          id: (Date.now() + 1).toString(),
          text: "I'm sorry, I couldn't process your request. Please try again later.",
          sender: "bot",
          timestamp: new Date(),
        }];
      });
      
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to get a response. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(
      "fixed z-50 transition-all duration-300",
      isMaximized 
        ? "inset-4 flex items-center justify-center"
        : "bottom-4 right-4"
    )}>
      {isOpen ? (
        <div className={cn(
          "bg-white rounded-lg shadow-lg flex flex-col",
          isMaximized 
            ? "w-full h-full max-w-4xl max-h-[800px] animate-in fade-in duration-200"
            : "w-[350px] h-[500px] animate-in slide-in-from-bottom-5 duration-200"
        )}>
          <div className="p-4 bg-primary text-primary-foreground rounded-t-lg flex justify-between items-center">
            <h3 className="font-semibold">Policy Assistant</h3>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground"
                onClick={() => setIsMaximized(!isMaximized)}
              >
                <Maximize className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground"
                onClick={() => {
                  setIsOpen(false);
                  setIsMaximized(false);
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex flex-col max-w-[80%] rounded-lg p-3",
                  message.sender === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="text-sm">{message.text}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message..."
                className="flex-1"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send"
                )}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <Button
          onClick={() => setIsOpen(true)}
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg animate-in fade-in duration-200"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
