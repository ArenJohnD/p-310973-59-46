import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  type: "user" | "bot";
  content: string;
}

export function PoliChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { type: "user", content: userMessage }]);
    setIsLoading(true);

    // Simulating AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        type: "bot", 
        content: "Hello! I'm Poli, your AI assistant. I'm here to help you find and understand NEU's policies. How can I assist you today?" 
      }]);
      setIsLoading(false);
    }, 1000);
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  return (
    <>
      {/* Backdrop for maximized state */}
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

      {/* Chat window container */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1,
              y: 0,
              scale: 1
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              width: isMaximized ? "calc(100vw - 4rem)" : "380px",
              height: isMaximized ? "calc(100vh - 4rem)" : "auto",
              maxWidth: isMaximized ? "1400px" : "380px",
              zIndex: 50,
              ...(isMaximized ? {
                top: "2rem",
                left: "12.5%",
                transform: "translateX(-50%)"
              } : {
                bottom: "6rem",
                right: "2.5rem"
              })
            }}
            className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
            >
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-[rgba(49,159,67,1)] to-[rgba(39,139,57,1)] p-5 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 rounded-lg p-2">
                  <MessageCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Chat with Poli</h3>
                  <p className="text-white/80 text-sm">NEU Policy Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  onClick={toggleMaximize}
                >
                  {isMaximized ? (
                    <Minimize2 className="h-5 w-5 text-white" />
                  ) : (
                    <Maximize2 className="h-5 w-5 text-white" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  onClick={() => {
                    setIsOpen(false);
                    setIsMaximized(false);
                  }}
                >
                  <X className="h-5 w-5 text-white" />
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <ScrollArea className={isMaximized ? "flex-1" : "h-[400px]"}>
              <div className="space-y-4 p-4">
                {messages.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-4 py-12">
                    <MessageCircle className="h-12 w-12 text-[rgba(49,159,67,0.3)]" />
                    <div>
                      <p className="font-medium mb-1">Welcome to NEUPoliSeek Chat!</p>
                      <p className="text-sm">Ask me anything about NEU's policies and I'll help you find the information you need.</p>
                    </div>
                  </div>
                )}
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.type === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-2 ${
                        message.type === "user"
                          ? "bg-[rgba(49,159,67,1)] text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-4 py-2">
                      <Loader2 className="h-5 w-5 animate-spin text-[rgba(49,159,67,1)]" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Chat Input */}
            <div className="p-4 border-t border-gray-200" style={{ paddingBottom: '1rem' }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about NEU policies..."
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)]"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Button */}
      <div className="fixed bottom-6 right-10 z-50">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) setIsMaximized(false);
          }}
          className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)] text-white rounded-full p-4 shadow-lg flex items-center gap-2"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="font-medium">Chat with Poli</span>
        </motion.button>
      </div>
    </>
  );
}