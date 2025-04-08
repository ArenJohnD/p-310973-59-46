import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Plus, Trash2, Menu, MessageSquare, X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from 'pdfjs-dist';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/context/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";

// Initialize PDF.js worker
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  is_active: boolean;
  user_id?: string;
  updated_at?: string;
}

interface ReferenceDocument {
  id: string;
  file_name: string;
  file_path: string;
  text_content?: string;
}

interface DocumentSection {
  title: string;
  content: string;
  pageNumber: number;
  articleNumber?: string;
  sectionId?: string;
}

interface ChatBotProps {
  isMaximized?: boolean;
}

export const ChatBot = ({ isMaximized = false }: ChatBotProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome",
    text: "Hi! I'm Poli, your NEU policy assistant. I can help you find information about university policies, answer questions about academic regulations, and guide you through administrative procedures. How can I assist you today?",
    sender: "bot",
    timestamp: new Date()
  }]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [referenceDocuments, setReferenceDocuments] = useState<ReferenceDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [typingAnimation, setTypingAnimation] = useState(false);
  const [currentResponseText, setCurrentResponseText] = useState("");
  const [showTypingMessage, setShowTypingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  useEffect(() => {
    fetchReferenceDocuments();
    
    if (user) {
      fetchChatSessions();
    }
  }, [user]);

  const fetchChatSessions = async () => {
    if (!user) return;
    
    try {
      setLoadingSessions(true);
      
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        setChatSessions(data as ChatSession[]);
        
        const activeSession = data.find(session => session.is_active);
        if (activeSession) {
          setCurrentSessionId(activeSession.id);
          loadChatMessages(activeSession.id);
        } else {
          createNewSession();
        }
      } else {
        createNewSession();
      }
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
      toast({
        title: "Error",
        description: "Failed to load chat sessions.",
        variant: "destructive",
      });
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadChatMessages = async (sessionId: string) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });
        
      if (error) throw error;
      
      if (data) {
        const formattedMessages: Message[] = data.map(msg => ({
          id: msg.id,
          text: msg.text,
          sender: msg.sender as "user" | "bot",
          timestamp: new Date(msg.timestamp)
        }));
        
        setMessages(formattedMessages.length > 0 ? formattedMessages : [{
          id: "welcome",
          text: "Hi! I'm Poli, your NEU policy assistant. I can help you find information about university policies, answer questions about academic regulations, and guide you through administrative procedures. How can I assist you today?",
          sender: "bot",
          timestamp: new Date()
        }]);
        
        setCurrentSessionId(sessionId);
        
        await supabase
          .from('chat_sessions')
          .update({ is_active: false })
          .eq('user_id', user.id);
          
        await supabase
          .from('chat_sessions')
          .update({ is_active: true })
          .eq('id', sessionId);
          
        setChatSessions(prev => 
          prev.map(session => ({
            ...session,
            is_active: session.id === sessionId
          }))
        );
      }
    } catch (error) {
      console.error("Error loading chat messages:", error);
      toast({
        title: "Error",
        description: "Failed to load chat messages.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createNewSession = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      if (chatSessions.length > 0) {
        await supabase
          .from('chat_sessions')
          .update({ is_active: false })
          .eq('user_id', user.id);
      }
      
      const { data: sessionData, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert([{
          user_id: user.id,
          title: 'New Chat',
          is_active: true
        }])
        .select();
        
      if (sessionError) throw sessionError;
      
      if (sessionData && sessionData.length > 0) {
        setChatSessions(prev => [sessionData[0] as ChatSession, ...prev.map(s => ({ ...s, is_active: false }))]);
        setCurrentSessionId(sessionData[0].id);
        
        setMessages([{
          id: "welcome",
          text: "Hi! I'm Poli, your NEU policy assistant. I can help you find information about university policies, answer questions about academic regulations, and guide you through administrative procedures. How can I assist you today?",
          sender: "bot",
          timestamp: new Date()
        }]);
        
        await supabase
          .from('chat_messages')
          .insert([{
            session_id: sessionData[0].id,
            text: "Hi! I'm Poli, your NEU policy assistant. I can help you find information about university policies, answer questions about academic regulations, and guide you through administrative procedures. How can I assist you today?",
            sender: "bot"
          }]);
      }
    } catch (error) {
      console.error("Error creating new session:", error);
      toast({
        title: "Error",
        description: "Failed to create new chat session.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      if (isMobile) {
        setSidebarOpen(false);
      }
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!user) return;
    
    try {
      await supabase
        .from('chat_messages')
        .delete()
        .eq('session_id', sessionId);
        
      await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);
        
      setChatSessions(prev => prev.filter(session => session.id !== sessionId));
      
      if (currentSessionId === sessionId) {
        const remainingSessions = chatSessions.filter(session => session.id !== sessionId);
        if (remainingSessions.length > 0) {
          loadChatMessages(remainingSessions[0].id);
        } else {
          createNewSession();
        }
      }
      
      toast({
        title: "Success",
        description: "Chat session deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting session:", error);
      toast({
        title: "Error",
        description: "Failed to delete chat session.",
        variant: "destructive",
      });
    }
  };

  const updateSessionTitle = async (sessionId: string, message: string, botResponse: string = "") => {
    if (!user) return;
    
    try {
      const title = await generateChatTitle(message, botResponse);
      
      await supabase
        .from('chat_sessions')
        .update({ title })
        .eq('id', sessionId);
        
      setChatSessions(prev => 
        prev.map(session => 
          session.id === sessionId ? { ...session, title } : session
        )
      );
    } catch (error) {
      console.error("Error updating session title:", error);
    }
  };

  const fetchReferenceDocuments = async () => {
    try {
      setLoadingDocuments(true);
      
      const { data, error } = await supabase
        .from('reference_documents')
        .select('id, file_name, file_path')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        console.log(`Found ${data.length} reference documents`);
        setReferenceDocuments(data);
      } else {
        setReferenceDocuments([]);
      }
    } catch (error) {
      console.error("Error fetching reference documents:", error);
      toast({
        title: "Error",
        description: "Failed to load reference documents",
        variant: "destructive",
      });
    } finally {
      setLoadingDocuments(false);
    }
  };

  const extractTextFromPDF = async (pdfUrl: string): Promise<string> => {
    try {
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      console.log(`PDF loaded with ${pdf.numPages} pages`);
      
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter((item: any) => 'str' in item)
          .map((item: any) => item.str)
          .join(' ');
          
        fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;
      }
      
      return fullText;
    } catch (error) {
      console.error("Error extracting text from PDF:", error);
      throw new Error(`PDF extraction failed: ${error}`);
    }
  };

  const extractDocumentSections = (text: string): DocumentSection[] => {
    const sections: DocumentSection[] = [];
    
    const articleRegex = /(?:ARTICLE|Article)\s+([IVX\d]+)(?:\s*[-:]\s*|\s+)(.*?)(?=\n|$)/gi;
    const sectionRegex = /(?:SECTION|Section)\s+(\d+(?:\.\d+)?(?:[A-Za-z])?)\s*[-:.]?\s*(.*?)(?=\n|$)/gi;
    const headingRegex = /(?:^|\n)((?:[A-Z][A-Za-z\s]+|[A-Z\s]+):?)(?=\n|$)/gm;
    const policyRegex = /(?:Policy|POLICY)\s+(?:Number|NUMBER)?\s*[:#]?\s*(\d+(?:\.\d+)?)/gi;
    
    const pageMarkers = text.match(/--- PAGE \d+ ---/g) || [];
    const pageTexts = text.split(/--- PAGE \d+ ---\n/).filter(Boolean);
    
    let currentArticle = '';
    let currentArticleTitle = '';

    pageTexts.forEach((pageText, pageIndex) => {
      const pageNumber = pageIndex + 1;
      
      let articleMatch;
      while ((articleMatch = articleRegex.exec(pageText)) !== null) {
        currentArticle = articleMatch[1];
        currentArticleTitle = articleMatch[2].trim();
        
        let articleContent = pageText.substring(articleMatch.index);
        const nextArticleMatch = new RegExp(articleRegex.source, 'gi');
        nextArticleMatch.lastIndex = articleMatch.index + articleMatch[0].length;
        const nextMatch = nextArticleMatch.exec(pageText);
        if (nextMatch) {
          articleContent = pageText.substring(articleMatch.index, nextMatch.index);
        }
        
        sections.push({
          title: `Article ${currentArticle}: ${currentArticleTitle}`,
          content: articleContent,
          pageNumber,
          articleNumber: currentArticle
        });
      }
      
      articleRegex.lastIndex = 0;
      
      let sectionMatch;
      while ((sectionMatch = sectionRegex.exec(pageText)) !== null) {
        const sectionId = sectionMatch[1];
        const sectionTitle = sectionMatch[2].trim();
        
        let startIndex = sectionMatch.index;
        let endIndex = pageText.length;
        
        const nextSectionMatch = new RegExp(sectionRegex.source, 'gi');
        nextSectionMatch.lastIndex = startIndex + sectionMatch[0].length;
        const nextMatch = nextSectionMatch.exec(pageText);
        if (nextMatch) {
          endIndex = nextMatch.index;
        }
        
        const content = pageText.substring(startIndex, endIndex).trim();
        
        sections.push({
          title: `Section ${sectionId}: ${sectionTitle}`,
          content,
          pageNumber,
          articleNumber: currentArticle,
          sectionId
        });
      }
      
      sectionRegex.lastIndex = 0;
      
      let policyMatch;
      while ((policyMatch = policyRegex.exec(pageText)) !== null) {
        const policyId = policyMatch[1];
        
        const startPos = Math.max(0, policyMatch.index - 500);
        const endPos = Math.min(pageText.length, policyMatch.index + 1000);
        const policyContext = pageText.substring(startPos, endPos);
        
        const titleMatch = policyContext.match(/(?:Title|TITLE|Subject|SUBJECT):\s*([^\n]+)/i);
        const policyTitle = titleMatch ? titleMatch[1].trim() : `Policy ${policyId}`;
        
        sections.push({
          title: `Policy ${policyId}: ${policyTitle}`,
          content: policyContext,
          pageNumber,
          sectionId: policyId
        });
      }
      
      policyRegex.lastIndex = 0;
      
      if (!sections.some(s => s.pageNumber === pageNumber)) {
        let headingMatch;
        while ((headingMatch = headingRegex.exec(pageText)) !== null) {
          const headingTitle = headingMatch[1].trim();
          
          let startIndex = headingMatch.index;
          let endIndex = pageText.length;
          
          const nextHeadingMatch = new RegExp(headingRegex.source, 'gm');
          nextHeadingMatch.lastIndex = startIndex + headingMatch[0].length;
          const nextMatch = nextHeadingMatch.exec(pageText);
          if (nextMatch) {
            endIndex = nextMatch.index;
          }
          
          const content = pageText.substring(startIndex, endIndex).trim();
          
          sections.push({
            title: headingTitle,
            content,
            pageNumber
          });
        }
        
        if (!sections.some(s => s.pageNumber === pageNumber)) {
          const paragraphs = pageText.split(/\n\s*\n/);
          let currentChunk = '';
          let chunkNumber = 1;
          
          paragraphs.forEach(paragraph => {
            if (currentChunk.length + paragraph.length > 1000) {
              sections.push({
                title: `Page ${pageNumber} - Part ${chunkNumber}`,
                content: currentChunk,
                pageNumber
              });
              chunkNumber++;
              currentChunk = paragraph;
            } else {
              currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            }
          });
          
          if (currentChunk) {
            sections.push({
              title: `Page ${pageNumber} - Part ${chunkNumber}`,
              content: currentChunk,
              pageNumber
            });
          }
        }
      }
    });
    
    console.log(`Extracted ${sections.length} sections from document`);
    return sections;
  };

  const findBestMatch = (query: string, sections: DocumentSection[]): DocumentSection[] => {
    const queryNormalized = query.toLowerCase().replace(/[^\w\s]/g, '');
    const queryTokens = queryNormalized
      .split(/\s+/)
      .filter(word => word.length > 2)
      .map(word => word.trim());
      
    if (queryTokens.length === 0) return [];
    
    const importantKeywords = [
      'policy', 'procedure', 'regulation', 'rule', 'guideline', 
      'requirement', 'mandatory', 'prohibited', 'permission', 'approval',
      'student', 'faculty', 'staff', 'admin', 'academic', 'conduct', 'discipline'
    ];
    
    const weightedQueryTokens = queryTokens.map(token => ({
      token,
      weight: importantKeywords.includes(token) ? 2.0 : 1.0
    }));
    
    const scoredSections = sections.map(section => {
      const contentNormalized = section.content.toLowerCase().replace(/[^\w\s]/g, '');
      const titleNormalized = section.title.toLowerCase().replace(/[^\w\s]/g, '');
      
      let score = 0;
      
      weightedQueryTokens.forEach(({ token, weight }) => {
        if (titleNormalized.includes(token)) {
          score += 10 * weight;
          
          if (titleNormalized.includes(queryNormalized)) {
            score += 30;
          }
        }
      });
      
      weightedQueryTokens.forEach(({ token, weight }) => {
        const regex = new RegExp(`\\b${token}\\b`, 'gi');
        const matches = (section.content.match(regex) || []).length;
        
        if (matches > 0) {
          score += Math.min(15, 5 + 2 * Math.log2(matches + 1)) * weight;
        }
      });
      
      if (section.articleNumber && section.sectionId) {
        score *= 1.2;
      }
      
      if (contentNormalized.includes(queryNormalized)) {
        score += 20;
      }
      
      if (queryTokens.length > 1) {
        const proximityBonus = calculateProximityScore(contentNormalized, queryTokens);
        score += proximityBonus;
      }
      
      return { section, score };
    });
    
    scoredSections.sort((a, b) => b.score - a.score);
    
    const significantMatches = scoredSections
      .filter(item => item.score > 5)
      .slice(0, 5)
      .map(item => item.section);
      
    console.log(`Found ${significantMatches.length} significant matches for query`);
    return significantMatches;
  };

  const calculateProximityScore = (text: string, queryTokens: string[]): number => {
    let proximityScore = 0;
    
    const positions: Record<string, number[]> = {};
    
    queryTokens.forEach(token => {
      positions[token] = [];
      let pos = text.indexOf(token);
      while (pos !== -1) {
        positions[token].push(pos);
        pos = text.indexOf(token, pos + 1);
      }
    });
    
    const allTokensPresent = queryTokens.every(token => positions[token].length > 0);
    if (!allTokensPresent) return 0;
    
    const allPositions: {token: string, pos: number}[] = [];
    Object.entries(positions).forEach(([token, poses]) => {
      poses.forEach(pos => {
        allPositions.push({ token, pos });
      });
    });
    
    allPositions.sort((a, b) => a.pos - b.pos);
    
    let minWindow = Number.MAX_SAFE_INTEGER;
    
    for (let i = 0; i < allPositions.length; i++) {
      const tokensInWindow = new Set<string>();
      tokensInWindow.add(allPositions[i].token);
      
      for (let j = i + 1; j < allPositions.length; j++) {
        tokensInWindow.add(allPositions[j].token);
        
        if (tokensInWindow.size === queryTokens.length) {
          const windowSize = allPositions[j].pos - allPositions[i].pos + 1;
          minWindow = Math.min(minWindow, windowSize);
          break;
        }
      }
    }
    
    if (minWindow < 100) {
      proximityScore = 15;
    } else if (minWindow < 300) {
      proximityScore = 10;
    } else if (minWindow < 600) {
      proximityScore = 5;
    }
    
    return proximityScore;
  };

  const findRelevantInformation = async (query: string): Promise<string> => {
    if (referenceDocuments.length === 0) {
      try {
        console.log("No reference documents found, using Mistral API directly");
        const { data, error } = await supabase.functions.invoke('mistral-chat', {
          body: { query, context: "" }
        });

        if (error) throw new Error(error.message);
        
        return data.answer;
      } catch (err) {
        console.error("Error calling Mistral API:", err);
        return "I'm sorry, I encountered an error while processing your question. Please try again later.";
      }
    }

    try {
      const allSections: DocumentSection[] = [];
      
      for (const doc of referenceDocuments) {
        if (!doc.text_content) {
          console.log(`Processing document: ${doc.file_name}`);
          try {
            const { data: fileData } = await supabase.storage
              .from('policy_documents')
              .createSignedUrl(doc.file_path, 3600);
              
            if (fileData?.signedUrl) {
              const text = await extractTextFromPDF(fileData.signedUrl);
              
              const docWithContent = { ...doc, text_content: text };
              setReferenceDocuments(prev => 
                prev.map(d => d.id === doc.id ? docWithContent : d)
              );
              
              const sections = extractDocumentSections(text);
              allSections.push(...sections);
              console.log(`Extracted ${sections.length} sections from ${doc.file_name}`);
            }
          } catch (err) {
            console.error(`Error extracting text from ${doc.file_name}:`, err);
          }
        } else {
          const sections = extractDocumentSections(doc.text_content);
          allSections.push(...sections);
          console.log(`Using ${sections.length} sections from cached document ${doc.file_name}`);
        }
      }
      
      console.log(`Total sections available: ${allSections.length}`);
      
      const bestMatches = findBestMatch(query, allSections);
      
      if (bestMatches.length > 0) {
        console.log(`Found ${bestMatches.length} relevant sections`);
        
        const context = bestMatches
          .map(match => `${match.title}\n${match.content}`)
          .join('\n\n');
        
        console.log("Context length: ", context.length);
        console.log("Sending query to Mistral with context");
        
        try {
          const { data, error } = await supabase.functions.invoke('mistral-chat', {
            body: { query, context }
          });

          if (error) throw new Error(error.message);
          
          return data.answer;
        } catch (err) {
          console.error("Error calling Mistral API with context:", err);
          
          return `Based on the policy documents, here's what I found:\n\n${bestMatches[0].content}`;
        }
      } else {
        console.log("No specific matches found. Using general context");
        
        const generalContext = allSections
          .slice(0, 5)
          .map(section => `${section.title}\n${section.content}`)
          .join('\n\n');
          
        try {
          const { data, error } = await supabase.functions.invoke('mistral-chat', {
            body: { query, context: generalContext }
          });

          if (error) throw new Error(error.message);
          
          return data.answer;
        } catch (err) {
          console.error("Error calling Mistral API with general context:", err);
          return "I couldn't find specific information about this in the policy documents. Please check the university handbook or ask an administrator.";
        }
      }
    } catch (error) {
      console.error("Error searching reference documents:", error);
      return "I encountered an error while searching the policy documents. Please try again later.";
    }
  };

  const generateChatTitle = async (userMessage: string, botResponse: string) => {
    try {
      let topic = '';
      
      const botFirstSentence = botResponse.split('.')[0].trim();
      if (botFirstSentence.length > 5 && botFirstSentence.length < 50) {
        if (botFirstSentence.includes('policy') || botFirstSentence.includes('regulation') || 
            botFirstSentence.includes('procedure') || botFirstSentence.includes('guideline')) {
          topic = botFirstSentence;
        }
      }
      
      if (!topic) {
        const questionMatch = userMessage.match(/(?:what|how|where|when|who|can|is|are|do|does).+?(\w+(?:\s+\w+){0,5})\??$/i);
        if (questionMatch && questionMatch[1]) {
          topic = `About ${questionMatch[1].trim()}`;
        } else {
          const words = userMessage.split(/\s+/);
          const keyWords = words.filter(word => word.length > 3).slice(0, 3);
          
          if (keyWords.length > 0) {
            const firstWord = keyWords[0].charAt(0).toUpperCase() + keyWords[0].slice(1);
            topic = `${firstWord} ${keyWords.slice(1).join(' ')}`;
          } else {
            topic = "New Conversation";
          }
        }
      }
      
      if (topic.length > 30) {
        topic = topic.substring(0, 30) + '...';
      }
      
      return topic;
    } catch (error) {
      console.error("Error generating title:", error);
      return "New Conversation";
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user) return;
    
    if (!currentSessionId) {
      await createNewSession();
      if (!currentSessionId) {
        toast({
          title: "Error",
          description: "Failed to create chat session. Please log in and try again.",
          variant: "destructive",
        });
        return;
      }
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: "user",
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);
    setTypingAnimation(true);
    setShowTypingMessage(true);
    
    try {
      const { error: userMsgError } = await supabase
        .from('chat_messages')
        .insert([{
          session_id: currentSessionId,
          text: userMessage.text,
          sender: "user"
        }]);
        
      if (userMsgError) throw userMsgError;
      
      const currentMessages = messages.filter(m => m.sender === "user");
      if (currentMessages.length === 0) {
        updateSessionTitle(currentSessionId, inputText);
      }
      
      const botResponse = await findRelevantInformation(inputText);
      
      updateSessionTitle(currentSessionId, inputText, botResponse);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: "bot",
        timestamp: new Date()
      };
      
      setTypingAnimation(false);
      setShowTypingMessage(false);
      setMessages(prev => [...prev, botMessage]);
      
      await supabase
        .from('chat_messages')
        .insert([{
          session_id: currentSessionId,
          text: botResponse,
          sender: "bot"
        }]);
    } catch (error) {
      console.error("Error generating response:", error);
      toast({
        title: "Error",
        description: "Failed to generate a response. Please try again.",
        variant: "destructive",
      });
      
      setTypingAnimation(false);
      setShowTypingMessage(false);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I encountered an error while processing your question. Please try again later.",
        sender: "bot",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const MobileChatSidebar = () => (
    <Drawer open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <DrawerTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="absolute left-2 top-2 z-10"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[80vh]">
        <div className="px-4 py-6 h-full flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Chats</h2>
            <Button onClick={() => {
              createNewSession();
              setSidebarOpen(false);
            }} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> New Chat
            </Button>
          </div>
          
          <ScrollArea className="flex-1 overflow-auto">
            {loadingSessions ? (
              <div className="flex justify-center items-center h-20">
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              </div>
            ) : chatSessions.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>No chat history found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chatSessions.map((session) => (
                  <div 
                    key={session.id} 
                    className={`flex items-center justify-between rounded-md px-3 py-2 ${
                      currentSessionId === session.id
                        ? "bg-green-100 text-green-900"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    <button
                      className="flex-1 truncate text-left"
                      onClick={() => {
                        loadChatMessages(session.id);
                        setSidebarOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{session.title}</span>
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="h-8 w-8 text-gray-500 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );

  const TypingIndicator = () => (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-[20px] px-4 py-3 bg-[rgba(49,159,67,1)] text-white">
        <div className="flex items-center">
          <span className="mr-2">Typing</span>
          <span className="typing-dot">.</span>
          <span className="typing-dot">.</span>
          <span className="typing-dot">.</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)] border border-[rgba(0,0,0,0.2)] rounded-[30px] p-4 w-full ${isMaximized ? 'h-full' : 'max-w-[1002px] mx-auto'}`}>
      <style>{`
        @keyframes blink {
          0% { opacity: 0.3; }
          50% { opacity: 1; }
          100% { opacity: 0.3; }
        }
        
        .typing-dot {
          animation: blink 1.4s infinite;
          animation-fill-mode: both;
        }
        
        .typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }
      `}</style>
      
      {user ? (
        <div className={`flex ${isMaximized ? 'h-full' : 'h-[450px]'} relative`}>
          {isMobile && <MobileChatSidebar />}
          
          {!isMobile && (
            <Collapsible
              open={!isCollapsed}
              onOpenChange={(open) => setIsCollapsed(!open)}
              className="relative"
            >
              <div className={`h-full bg-white border-r border-gray-200 transition-all ${isCollapsed ? 'w-0 overflow-hidden' : 'w-64'}`}>
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Your Chats</h2>
                  </div>
                </div>
                
                <ScrollArea className="h-[calc(100%-130px)] overflow-auto">
                  {loadingSessions ? (
                    <div className="flex justify-center items-center h-20">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                    </div>
                  ) : chatSessions.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 px-4">
                      <p>No chat history found</p>
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {chatSessions.map((session) => (
                        <div 
                          key={session.id} 
                          className={`group relative flex items-center justify-between rounded-md px-3 py-2 ${
                            currentSessionId === session.id
                              ? "bg-green-100 text-green-900"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          <button
                            className="flex-1 truncate text-left"
                            onClick={() => loadChatMessages(session.id)}
                          >
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">{session.title}</span>
                            </div>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteSession(session.id)}
                            className="h-6 w-6 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                
                {!isCollapsed && (
                  <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={createNewSession}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" /> New Chat
                    </Button>
                  </div>
                )}
              </div>
              
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute -right-4 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full border shadow-sm z-10 bg-white"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="flex-1">
                {/* Main chat area appears here when sidebar is collapsed */}
              </CollapsibleContent>
            </Collapsible>
          )}
          
          <div className={`flex-1 flex flex-col relative h-full ${isMobile ? 'pt-10' : ''}`}>
            {isMobile && (
              <Button 
                variant="outline" 
                size="icon" 
                className="absolute left-2 top-2"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            
            <ScrollArea ref={scrollAreaRef} className={`flex-1 w-full ${isMobile ? 'pt-10' : ''} px-2`}>
              <div className="flex flex-col gap-4 p-2">
                {messages.map((message) => (
                  <div 
                    key={message.id}
                    className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div 
                      className={`max-w-[80%] rounded-[20px] px-4 py-3 ${
                        message.sender === "user" 
                          ? "bg-[rgba(49,159,67,0.1)] text-black" 
                          : "bg-[rgba(49,159,67,1)] text-white"
                      }`}
                    >
                      {message.sender === "bot" ? (
                        <ReactMarkdown className="text-[16px] whitespace-pre-line markdown-content">
                          {message.text}
                        </ReactMarkdown>
                      ) : (
                        <p className="text-[16px] whitespace-pre-line">{message.text}</p>
                      )}
                      <p className="text-[12px] opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {showTypingMessage && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            <div className="flex items-center gap-2 mt-4">
              <Input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about school policies..."
                className="rounded-full bg-transparent border-[rgba(0,0,0,0.2)]"
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={isLoading}
              />
              <Button 
                onClick={handleSendMessage} 
                className="rounded-full aspect-square p-2 bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)]"
                disabled={isLoading || !user}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className={isMaximized ? 'h-full' : ''}>
          <ScrollArea ref={scrollAreaRef} className={isMaximized ? 'h-[80vh]' : 'h-[350px]'}>
            <div className="flex flex-col gap-4 p-2">
              {messages.map((message) => (
                <div 
                  key={message.id}
                  className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div 
                    className={`max-w-[80%] rounded-[20px] px-4 py-3 ${
                      message.sender === "user" 
                        ? "bg-[rgba(49,159,67,0.1)] text-black" 
                        : "bg-[rgba(49,159,67,1)] text-white"
                    }`}
                  >
                    {message.sender === "bot" ? (
                      <ReactMarkdown className="text-[16px] whitespace-pre-line markdown-content">
                        {message.text}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-[16px] whitespace-pre-line">{message.text}</p>
                    )}
                    <p className="text-[12px] opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          
          <div className="flex items-center gap-2 mt-4">
            <Input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask about school policies..."
              className="rounded-full bg-transparent border-[rgba(0,0,0,0.2)]"
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              disabled={isLoading}
            />
            <Button 
              onClick={handleSendMessage} 
              className="rounded-full aspect-square p-2 bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)]"
              disabled={isLoading || !user}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
