import { useCallback, useEffect, useState } from "react";
import { Message } from "@/types/chat";

// For session-based persistence
const LOCAL_STORAGE_KEY = "guest_chat_messages_v1";

type UseGuestChatSessionProps = {
  welcomeMessage: Message;
};

export function useGuestChatSession({ welcomeMessage }: UseGuestChatSessionProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) {
          // Convert any legacy timestamps
          return saved.map((msg: any) => ({
            ...msg,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          }))
        }
      } catch {
        /* ignore bad json */
      }
    }
    return [welcomeMessage];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple persistence
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const clearSession = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setMessages([welcomeMessage]);
  }, [welcomeMessage]);

  const sendMessage = useCallback(async (text: string) => {
    setIsLoading(true);
    setError(null);

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await supabase.functions.invoke('mistral-chat', {
        body: { 
          query: text, 
          context: "" 
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.answer || "I'm sorry, I couldn't answer that right now.",
        sender: "bot",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      const friendly =
        typeof err?.message === "string" && err.message.length < 200
          ? err.message
          : "Sorry, there was an issue getting a response from the AI.";
      setError(friendly);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: "I'm sorry, I couldn't answer that right now.",
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearSession,
  };
}
