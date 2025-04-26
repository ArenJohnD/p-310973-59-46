import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Maximize2,
  Minimize2,
  History,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface Message {
  type: "user" | "bot";
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
}

export function PoliChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([
    {
      id: "1",
      title: "Policy Discussion",
      lastMessage: "Here are the academic policies you requested...",
      timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    },
    {
      id: "2",
      title: "Admission Requirements",
      lastMessage: "The admission requirements include...",
      timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    
    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      { type: "user", content: userMessage, timestamp: new Date() },
    ]);
    
    setIsLoading(true);

    try {
      // Format messages for Mistral API
      const formattedMessages = messages.map(msg => ({
        id: Date.now().toString() + Math.random().toString(),
        text: msg.content,
        sender: msg.type === "user" ? "user" : "bot",
        timestamp: msg.timestamp
      }));
      
      // Add the new user message
      formattedMessages.push({
        id: Date.now().toString(),
        text: userMessage,
        sender: "user",
        timestamp: new Date()
      });

      // Call the Mistral chat edge function
      const response = await supabase.functions.invoke('mistral-chat', {
        body: { 
          messages: formattedMessages,
          context: "" 
        }
      });

      if (response.error) {
        console.error('Edge function error:', response.error);
        throw new Error(response.error.message || 'Failed to get a response');
      }

      const { answer } = response.data;
      
      // Add bot response to chat
      setMessages((prev) => [
        ...prev,
        {
          type: "bot",
          content: answer,
          timestamp: new Date(),
        },
      ]);
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

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  const toggleHistory = () => {
    setIsHistoryOpen(!isHistoryOpen);
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && isMaximized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/5 backdrop-blur-sm z-40"
            onClick={() => setIsMaximized(false)}
          />
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              width: isMaximized ? "calc(100vw - 4rem)" : "380px",
              height: isMaximized ? "calc(100vh - 4rem)" : "600px",
              maxWidth: isMaximized ? "1400px" : "380px",
              maxHeight: "90vh",
              zIndex: 50,
              ...(isMaximized
                ? { top: "2rem", left: "12.5%", transform: "translateX(-50%)" }
                : { bottom: "6rem", right: "2.5rem" }),
            }}
            className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
          >
            {/* Main content flex */}
            <div className="flex h-full flex-grow min-h-0">
              {/* History Sidebar (Maximized) */}
              {isMaximized && (
                <AnimatePresence>
                  {isHistoryOpen && (
                    <motion.div
                      key="history-sidebar"
                      initial={{ width: 0, opacity: 0, marginRight: 0 }}
                      animate={{ width: 300, opacity: 1, marginRight: isHistoryOpen ? '0' : '-300px' }}
                      exit={{ width: 0, opacity: 0, marginRight: '-300px' }}
                      transition={{ duration: 0.2 }}
                      className="border-r border-gray-200 bg-gray-50 flex flex-col flex-shrink-0"
                    >
                      <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <History className="h-5 w-5 text-[rgba(49,159,67,1)]" />
                          Chat History
                        </h3>
                      </div>
                      <ScrollArea className="flex-1">
                        <div className="p-2 space-y-2">
                          {chatSessions.map((session) => (
                            <button
                              key={session.id}
                              className="w-full p-3 rounded-lg hover:bg-white text-left transition-colors border border-transparent hover:border-gray-200"
                            >
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-gray-900 truncate">{session.title}</span>
                                <span className="text-sm text-gray-500 truncate">{session.lastMessage}</span>
                                <span className="text-xs text-gray-400">{session.timestamp.toLocaleString()}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* Main Chat Area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Chat Header */}
                <div className="bg-gradient-to-r from-[rgba(49,159,67,1)] to-[rgba(39,139,57,1)] p-4 flex items-center justify-between shadow-md flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                      onClick={toggleHistory}
                      aria-label={
                        isMaximized
                          ? (isHistoryOpen ? "Hide History Sidebar" : "Show History Sidebar")
                          : (isHistoryOpen ? "Collapse Chat History" : "Expand Chat History")
                      }
                    >
                      {isMaximized ? (
                        isHistoryOpen ? (
                          <ChevronLeft className="h-4 w-4 text-white" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-white" />
                        )
                      ) : (
                        isHistoryOpen ? (
                          <ChevronUp className="h-4 w-4 text-white" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-white" />
                        )
                      )}
                    </Button>

                    <div className="bg-white/10 rounded-lg p-1.5">
                      <MessageCircle className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-sm">Chat with Poli</h3>
                      <p className="text-white/80 text-xs">NEU Policy Assistant</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                      onClick={toggleMaximize}
                      aria-label={isMaximized ? "Minimize Chat" : "Maximize Chat"}
                    >
                      {isMaximized ? <Minimize2 className="h-4 w-4 text-white" /> : <Maximize2 className="h-4 w-4 text-white" />}
                    </Button>
                  </div>
                </div>

                {/* History Dropdown (Default) */}
                <AnimatePresence>
                  {!isMaximized && isHistoryOpen && (
                    <motion.div
                      key="history-default"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-b border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0"
                    >
                      <ScrollArea className="max-h-[150px]">
                        <div className="p-2 space-y-1">
                          {chatSessions.map((session) => (
                            <button
                              key={session.id}
                              className="w-full p-2 rounded-md hover:bg-white text-left transition-colors border border-transparent hover:border-gray-200 text-xs"
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-gray-900 truncate">{session.title}</span>
                                <span className="text-gray-500 truncate">{session.lastMessage}</span>
                                <span className="text-gray-400">{session.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Chat Messages */}
                <ScrollArea className="flex-1 min-h-0">
                  <div className="space-y-4 p-4">
                    {messages.length === 0 && !isLoading && (
                      <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-4 py-12">
                        <MessageCircle className="h-12 w-12 text-[rgba(49,159,67,0.3)]" />
                        <div>
                          <p className="font-medium mb-1">Welcome to NEUPoliSeek Chat!</p>
                          <p className="text-sm">Ask me anything about NEU's policies...</p>
                        </div>
                      </div>
                    )}
                    {messages.map((message, index) => (
                      <div key={index} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-lg px-3 py-2 shadow-sm ${message.type === "user" ? "bg-[rgba(49,159,67,1)] text-white" : "bg-gray-100 text-gray-900"}`}>
                          <div className="text-sm">{message.content}</div>
                          <div className="text-xs opacity-70 mt-1 text-right">{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-lg px-3 py-2 inline-block">
                          <Loader2 className="h-4 w-4 animate-spin text-[rgba(49,159,67,1)]" />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Chat Input */}
                <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
                  <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask about NEU policies..."
                      className="flex-1 text-sm h-9"
                      disabled={isLoading}
                    />
                    <Button type="submit" disabled={!input.trim() || isLoading} className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)] h-9 px-3 disabled:opacity-50">
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Button */}
      <div className="fixed bottom-6 right-10 z-[60]">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { setIsOpen(!isOpen); if (!isOpen) { setIsMaximized(false); setIsHistoryOpen(false); } }}
          className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)] text-white rounded-full p-3 shadow-lg flex items-center gap-2 text-sm"
          aria-label={isOpen ? "Close Chat" : "Open Chat"}
        >
          {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
          <span className="font-medium sr-only">{isOpen ? "Close" : "Chat with Poli"}</span>
          {!isOpen && <span className="font-medium">Chat with Poli</span>}
        </motion.button>
      </div>
    </>
  );
}
