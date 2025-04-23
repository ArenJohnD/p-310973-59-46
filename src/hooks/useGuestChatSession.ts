
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

    // Simulate AI response by calling the same backend as authenticated user
    try {
      // Replace with actual endpoint or edge function as needed
      // Here, we call the "huggingface-chat" via Supabase
      const response = await fetch("/functions/v1/huggingface-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, context: "" })
      });

      if (!response.ok) throw new Error("AI service unavailable.");
      const data = await response.json();
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.answer || "I'm sorry, I couldn't answer that right now.",
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setError("Sorry, there was an issue getting a response from the AI.");
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
