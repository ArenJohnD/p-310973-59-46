
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
      // Still using the endpoint named huggingface-chat but it's now using Groq API internally
      const response = await fetch("/functions/v1/huggingface-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, context: "" })
      });

      if (!response.ok) {
        let msg = "AI service unavailable.";
        try {
          const errorData = await response.json();
          if (typeof errorData.answer === "string" && errorData.answer.length < 200) {
            msg = errorData.answer;
          }
          
          // Handle token limit errors specifically
          if (response.status === 413) {
            msg = errorData.answer || "Your question requires processing a large amount of information. Please try asking a more specific question.";
          }
        } catch {
          // Unable to parse response, use default message
          if (response.status === 413) {
            msg = "Your question is too complex. Please try asking a more specific or shorter question.";
          }
        }
        throw new Error(msg);
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
