
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { ChatInput } from "@/components/chat/ChatInput";
import { Loader2, LogOut } from "lucide-react";
import { useGuestChatSession } from "@/hooks/useGuestChatSession";
import { toast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";

const welcomeMessage = {
  id: "guest-welcome",
  text: "Hi! I'm Poli, your NEU policy assistant. I can help you find information about university policies, answer questions about academic regulations, and guide you through administrative procedures. How can I assist you today?",
  sender: "bot" as const,
  timestamp: new Date(),
};

const GuestChat = () => {
  const navigate = useNavigate();
  const {
    messages,
    sendMessage,
    isLoading,
    clearSession,
    error,
  } = useGuestChatSession({ welcomeMessage });
  const [showTypingMessage, setShowTypingMessage] = useState(false);

  const handleSend = async (inputText: string) => {
    if (!inputText.trim()) return;
    setShowTypingMessage(true);
    await sendMessage(inputText);
    setShowTypingMessage(false);
  };

  const handleGuestLogout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[rgba(233,233,233,1)]">
      <div className="bg-white rounded-[30px] shadow-lg border border-[rgba(0,0,0,0.20)] w-full max-w-[1002px] h-[75vh] flex flex-col">
        <div className="flex justify-between items-center px-8 pt-8 pb-4">
          <h2 className="text-2xl font-bold text-[rgba(49,159,67,1)]">Guest Chatbot</h2>
          <Button variant="ghost" size="icon" onClick={handleGuestLogout} title="Exit Guest Mode">
            <LogOut className="h-5 w-5 text-gray-400" />
            <span className="sr-only">Exit Guest Mode</span>
          </Button>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 px-6">
            <div className="flex flex-col gap-4 py-2">
              {messages.length === 0 && (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-[rgba(49,159,67,1)]" />
                </div>
              )}
              {messages.map((message, idx) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  // No citations for guest, but future-proof if needed
                />
              ))}
              {showTypingMessage && <TypingIndicator />}
              {error && (
                <div className="bg-red-100 text-red-600 p-2 rounded mt-2">
                  {error}
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="p-6">
            <ChatInput onSendMessage={handleSend} isLoading={isLoading} disabled={isLoading} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestChat;
