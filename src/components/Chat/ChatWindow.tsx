
import { useState } from "react";
import { Message } from "@/types/chat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

interface ChatWindowProps {
  welcomeMessage?: string;
}

export function ChatWindow({ welcomeMessage = "Hello! How can I help you?" }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "0", text: welcomeMessage, sender: "bot", timestamp: new Date() }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [citations, setCitations] = useState<Array<{ content: string; similarity: number }>>([]);
  const { toast } = useToast();

  const handleSend = async (text: string) => {
    try {
      setIsLoading(true);
      const userMessage: Message = {
        id: Date.now().toString(),
        text,
        sender: "user",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      const response = await supabase.functions.invoke('mistral-chat', {
        body: { 
          messages: [...messages, userMessage],
          context: "" 
        }
      });

      if (response.error) throw response.error;

      const { answer, context } = response.data;
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: answer,
        sender: "bot",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      setCitations(context);

    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] border rounded-lg bg-white overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {messages.map((message, index) => (
          <ChatMessage 
            key={message.id} 
            message={message}
            citations={message.sender === 'bot' ? citations : undefined}
          />
        ))}
        {isLoading && (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}
      </div>
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
