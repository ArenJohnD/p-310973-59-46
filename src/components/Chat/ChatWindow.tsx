
import { useState, useEffect } from "react";
import { Message } from "@/types/chat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface ChatWindowProps {
  welcomeMessage?: string;
  sessionId?: string;
}

export function ChatWindow({ 
  welcomeMessage = "Hello! How can I help you?", 
  sessionId: initialSessionId 
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "0", text: welcomeMessage, sender: "bot", timestamp: new Date() }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [citations, setCitations] = useState<Array<{ content: string; similarity: number }>>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load previous messages if sessionId is provided
  useEffect(() => {
    const loadChatSession = async () => {
      if (!sessionId) return;

      try {
        setIsLoading(true);
        
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          const formattedMessages: Message[] = data.map(msg => ({
            id: msg.id,
            text: msg.content,
            sender: msg.sender === 'user' ? 'user' : 'bot',
            timestamp: new Date(msg.created_at)
          }));
          
          // Replace the welcome message with the actual chat history
          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error('Error loading chat session:', error);
        toast({
          title: "Error",
          description: "Failed to load chat messages.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (sessionId) {
      loadChatSession();
    }
  }, [sessionId, toast]);

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

      // Check if we need to create a new session
      let currentSessionId = sessionId;
      if (!currentSessionId && user) {
        const { data, error } = await supabase
          .from('chat_sessions')
          .insert({
            title: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
            user_id: user.id,
            last_message: ''
          })
          .select('id')
          .single();
          
        if (error) {
          console.error('Error creating chat session:', error);
        } else {
          currentSessionId = data.id;
          setSessionId(currentSessionId);
        }
      }

      // Call the Mistral chat edge function with all previous messages
      const response = await supabase.functions.invoke('mistral-chat', {
        body: { 
          messages: [...messages, userMessage],
          sessionId: currentSessionId,
          userId: user?.id
        }
      });

      if (response.error) {
        console.error('Edge function error:', response.error);
        throw new Error(response.error.message || 'Failed to get a response');
      }

      const { answer, context } = response.data;
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: answer,
        sender: "bot",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      setCitations(context || []);

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
