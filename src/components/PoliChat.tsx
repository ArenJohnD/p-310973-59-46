
import { useState, useEffect, useRef } from "react";
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
  PlusCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";

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
  isActive?: boolean;
}

export function PoliChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch chat sessions when component mounts
  useEffect(() => {
    if (isOpen && user) {
      fetchChatSessions();
    }
  }, [isOpen, user]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Fetch chat sessions from Supabase
  const fetchChatSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      const formattedSessions: ChatSession[] = data.map((session) => ({
        id: session.id,
        title: session.title || 'Untitled Chat',
        lastMessage: session.last_message || '',
        timestamp: new Date(session.updated_at || session.created_at),
        isActive: session.id === currentSessionId,
      }));

      setChatSessions(formattedSessions);
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load chat history.",
        variant: "destructive",
      });
    }
  };

  // Create a new chat session
  const createNewChatSession = async () => {
    try {
      // Create a new chat session in the database
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          title: 'New Chat',
          user_id: user?.id,
          last_message: ''
        })
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      // Set as current session and clear messages
      setCurrentSessionId(data.id);
      setMessages([]);
      
      // Add to chat sessions list
      const newSession: ChatSession = {
        id: data.id,
        title: 'New Chat',
        lastMessage: '',
        timestamp: new Date(),
        isActive: true,
      };

      setChatSessions((prev) => {
        const updated = prev.map(s => ({ ...s, isActive: false }));
        return [newSession, ...updated];
      });
    } catch (error) {
      console.error('Error creating new chat session:', error);
      toast({
        title: "Error",
        description: "Failed to create a new chat.",
        variant: "destructive",
      });
    }
  };

  // Load messages for a specific chat session
  const loadChatSession = async (sessionId: string) => {
    try {
      setIsLoading(true);

      // Update active session in UI immediately
      setChatSessions(prev => 
        prev.map(session => ({
          ...session,
          isActive: session.id === sessionId
        }))
      );
      
      // Fetch messages for this session
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Format messages for the UI
      const formattedMessages: Message[] = data.map(msg => ({
        type: msg.sender === 'user' ? 'user' : 'bot',
        content: msg.content,
        timestamp: new Date(msg.created_at)
      }));

      setMessages(formattedMessages);
      setCurrentSessionId(sessionId);
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

  // Delete a chat session
  const deleteChatSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent button click
    
    try {
      // Delete the chat session and all its messages (cascading delete should be set up in the database)
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        throw error;
      }

      // Remove from UI
      setChatSessions(prev => prev.filter(session => session.id !== sessionId));
      
      // Clear current messages if the deleted session was the active one
      if (currentSessionId === sessionId) {
        setMessages([]);
        setCurrentSessionId(null);
      }

      toast({
        title: "Success",
        description: "Chat history deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting chat session:', error);
      toast({
        title: "Error",
        description: "Failed to delete chat history.",
        variant: "destructive",
      });
    }
  };

  // Handle sending a message
  const handleSend = async () => {
    if (!input.trim()) return;
    
    let sessionId = currentSessionId;
    const userMessage = input.trim();
    setInput("");
    
    try {
      // If no active session, create one
      if (!sessionId && user) {
        const { data, error } = await supabase
          .from('chat_sessions')
          .insert({
            title: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
            user_id: user.id,
            last_message: ''
          })
          .select('*')
          .single();
          
        if (error) throw error;
        sessionId = data.id;
        setCurrentSessionId(data.id);
        
        // Add to chat sessions list
        const newSession: ChatSession = {
          id: data.id,
          title: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
          lastMessage: '',
          timestamp: new Date(),
          isActive: true,
        };
        
        setChatSessions(prev => {
          const updated = prev.map(s => ({ ...s, isActive: false }));
          return [newSession, ...updated];
        });
      }
      
      // Add user message to chat
      const newUserMessage = {
        type: "user" as const,
        content: userMessage,
        timestamp: new Date()
      };
      
      setMessages((prev) => [...prev, newUserMessage]);
      setIsLoading(true);

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
          context: "",
          sessionId,
          userId: user?.id
        }
      });

      if (response.error) {
        console.error('Edge function error:', response.error);
        throw new Error(response.error.message || 'Failed to get a response');
      }

      const { answer } = response.data;
      
      // Update the chat session title if it's a new session
      if (chatSessions.find(s => s.id === sessionId)?.title === 'New Chat') {
        const updatedTitle = userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
        await supabase
          .from('chat_sessions')
          .update({ title: updatedTitle })
          .eq('id', sessionId);

        setChatSessions(prev => prev.map(session => 
          session.id === sessionId 
            ? { ...session, title: updatedTitle }
            : session
        ));
      }
      
      // Add bot response to chat
      const botResponse = {
        type: "bot" as const,
        content: answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);

      // Update session in the list with new last message
      setChatSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { 
              ...session,
              lastMessage: answer.substring(0, 100) + (answer.length > 100 ? '...' : ''),
              timestamp: new Date()
            }
          : session
      ));
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
                ? { top: "2rem", left: "50%", transform: "translateX(-50%)" }
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-full hover:bg-[rgba(49,159,67,0.1)] text-[rgba(49,159,67,1)]"
                          onClick={createNewChatSession}
                        >
                          <PlusCircle className="h-4 w-4" />
                          <span className="sr-only">New Chat</span>
                        </Button>
                      </div>
                      <ScrollArea className="flex-1">
                        <div className="p-2 space-y-2">
                          {chatSessions.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-sm">
                              No chat history yet
                            </div>
                          ) : (
                            chatSessions.map((session) => (
                              <button
                                key={session.id}
                                onClick={() => loadChatSession(session.id)}
                                className={cn(
                                  "w-full p-3 rounded-lg text-left transition-colors relative border",
                                  session.isActive
                                    ? "bg-[rgba(49,159,67,0.1)] border-[rgba(49,159,67,0.3)]"
                                    : "hover:bg-white border-transparent hover:border-gray-200"
                                )}
                              >
                                <div className="flex flex-col gap-1 pr-7">
                                  <span className="font-medium text-gray-900 truncate">{session.title}</span>
                                  <span className="text-sm text-gray-500 truncate">{session.lastMessage}</span>
                                  <span className="text-xs text-gray-400">{session.timestamp.toLocaleString()}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0 absolute top-2 right-2 text-gray-400 hover:text-red-500 hover:bg-transparent"
                                  onClick={(e) => deleteChatSession(session.id, e)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </button>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                      <div className="p-3 border-t border-gray-200">
                        <Button
                          variant="outline" 
                          className="w-full border-[rgba(49,159,67,1)] text-[rgba(49,159,67,1)] hover:bg-[rgba(49,159,67,0.1)] hover:text-[rgba(49,159,67,1)]"
                          onClick={createNewChatSession}
                        >
                          <PlusCircle className="h-4 w-4 mr-2" />
                          New Chat
                        </Button>
                      </div>
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
                      <div className="p-2 flex justify-between items-center">
                        <h3 className="text-sm font-medium">Recent Chats</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 rounded-full hover:bg-[rgba(49,159,67,0.1)] text-[rgba(49,159,67,1)]"
                          onClick={createNewChatSession}
                        >
                          <PlusCircle className="h-4 w-4" />
                          <span className="sr-only">New Chat</span>
                        </Button>
                      </div>
                      <ScrollArea className="max-h-[150px]">
                        <div className="p-2 space-y-1">
                          {chatSessions.length === 0 ? (
                            <div className="p-2 text-center text-gray-500 text-xs">
                              No chat history yet
                            </div>
                          ) : (
                            chatSessions.map((session) => (
                              <button
                                key={session.id}
                                onClick={() => loadChatSession(session.id)}
                                className={cn(
                                  "w-full p-2 rounded-md text-left transition-colors border text-xs relative",
                                  session.isActive
                                    ? "bg-[rgba(49,159,67,0.1)] border-[rgba(49,159,67,0.3)]"
                                    : "hover:bg-white border-transparent hover:border-gray-200"
                                )}
                              >
                                <div className="flex flex-col gap-0.5 pr-6">
                                  <span className="font-medium text-gray-900 truncate">{session.title}</span>
                                  <span className="text-gray-500 truncate">{session.lastMessage}</span>
                                  <span className="text-gray-400">{session.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 p-0 absolute top-1 right-1 text-gray-400 hover:text-red-500 hover:bg-transparent"
                                  onClick={(e) => deleteChatSession(session.id, e)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </button>
                            ))
                          )}
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
                    <div ref={messagesEndRef} />
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
                    <Button 
                      type="submit" 
                      disabled={!input.trim() || isLoading} 
                      className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)] h-9 px-3 disabled:opacity-50"
                    >
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
