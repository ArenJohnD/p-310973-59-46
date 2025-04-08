import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Send, Settings, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface ChatHistoryItem {
  title?: string;
  messages: ChatMessage[];
}

export const ChatBot = ({ isMaximized }: { isMaximized: boolean }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [currentChatIndex, setCurrentChatIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const startNewChat = () => {
    setChatHistory([{ messages: [] }]);
    setCurrentChatIndex(0);
  };

  const switchChat = (index: number) => {
    setCurrentChatIndex(index);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = useCallback(async () => {
    if (!message.trim()) return;

    const userMessage = { role: "user", content: message };
    const updatedChatHistory = [...chatHistory];
    if (!updatedChatHistory[currentChatIndex]) {
      updatedChatHistory[currentChatIndex] = { messages: [] };
    }
    updatedChatHistory[currentChatIndex].messages = [
      ...updatedChatHistory[currentChatIndex].messages,
      userMessage,
    ];
    setChatHistory(updatedChatHistory);

    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/supabase/functions/mistral-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: message }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const aiMessage = { role: "system", content: data.answer };

      const updatedChatHistoryWithResponse = [...chatHistory];
      updatedChatHistoryWithResponse[currentChatIndex].messages = [
        ...updatedChatHistoryWithResponse[currentChatIndex].messages,
        userMessage,
        aiMessage,
      ];
      setChatHistory(updatedChatHistoryWithResponse);

      // Update chat title based on the first user message
      if (!chatHistory[currentChatIndex].title) {
        const title = message.length > 20 ? message.substring(0, 20) + "..." : message;
        const updatedChatHistoryWithTitle = [...chatHistory];
        updatedChatHistoryWithTitle[currentChatIndex].title = title;
        setChatHistory(updatedChatHistoryWithTitle);
      }
    } catch (error: any) {
      console.error("Error calling Mistral API:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate response. Please try again.",
      });
    } finally {
      setIsLoading(false);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [message, chatHistory, currentChatIndex, toast]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className={`w-full rounded-lg border shadow-sm overflow-hidden ${isMaximized ? 'h-full' : 'h-[500px]'}`}>
      <div className="flex h-full">
        {/* Sidebar */}
        <div className={`${isSidebarOpen ? 'w-64' : 'w-12'} bg-sidebar transition-all duration-200 flex flex-col border-r`}>
          {/* New Chat Button */}
          <Button 
            variant="ghost" 
            className={`flex items-center gap-2 m-2 ${isSidebarOpen ? '' : 'hidden'}`} 
            onClick={startNewChat}
          >
            <Plus size={18} />
            <span>New Chat</span>
          </Button>
  
          {/* Chat History */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {chatHistory.map((chat, index) => (
                <div
                  key={index}
                  className={`py-2 px-3 text-sm rounded-lg mb-1 cursor-pointer hover:bg-muted truncate flex items-center ${
                    currentChatIndex === index ? 'bg-muted' : ''
                  } ${isSidebarOpen ? '' : 'justify-center'}`}
                  onClick={() => switchChat(index)}
                >
                  {isSidebarOpen ? (
                    chat.title || 'New conversation'
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                      {(chat.title || 'N').charAt(0)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
  
          {/* Settings Button */}
          <div className="p-2 border-t">
            <Button variant="ghost" size="icon">
              <Settings size={18} />
            </Button>
          </div>
        </div>
        
        {/* Main Chat Area with conditional separator styling */}
        <div className="flex-1 flex flex-col relative">
          {/* Sidebar Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 left-2 z-10 h-8 w-8"
            onClick={toggleSidebar}
          >
            <Separator 
              orientation="vertical" 
              className={`mx-auto ${isSidebarOpen ? 'h-4' : 'h-4'} bg-gray-400`} 
            />
            <Separator 
              orientation="vertical" 
              className={`mx-auto ${isSidebarOpen ? 'h-4' : 'h-4'} mt-0.5 bg-gray-400`} 
            />
          </Button>

          {/* Chat Messages */}
          <ScrollArea className="flex-1 p-4">
            {chatHistory[currentChatIndex]?.messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-2 p-3 rounded-lg ${
                  msg.role === "user" ? "bg-primary/10 text-primary-foreground ml-auto w-fit" : "bg-muted"
                }`}
              >
                {msg.content}
              </div>
            ))}
            {isLoading && (
              <div className="mb-2 p-3 rounded-lg bg-muted">
                Thinking...
              </div>
            )}
          </ScrollArea>
          
          {/* Input Area */}
          <div className="border-t p-4">
            <div className="relative">
              <Input
                ref={inputRef}
                placeholder="Type your message..."
                value={message}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="pr-12"
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading}
                className="absolute right-1 top-1 rounded-full"
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
