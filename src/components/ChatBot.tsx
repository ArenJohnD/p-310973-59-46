
import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from 'pdfjs-dist';
import { GlobalWorkerOptions } from 'pdfjs-dist';

// Initialize PDF.js worker
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
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

export const ChatBot = () => {
  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome",
    text: "Hello! I'm your NEUPoliSeek Assistant. How can I help you with school policies today?",
    sender: "bot",
    timestamp: new Date()
  }]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [referenceDocuments, setReferenceDocuments] = useState<ReferenceDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch reference documents on component mount
  useEffect(() => {
    fetchReferenceDocuments();
  }, []);

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
    
    // Enhanced regex patterns to capture more document structures
    const articleRegex = /(?:ARTICLE|Article)\s+([IVX\d]+)(?:\s*[-:]\s*|\s+)(.*?)(?=\n|$)/gi;
    const sectionRegex = /(?:SECTION|Section)\s+(\d+(?:\.\d+)?(?:[A-Za-z])?)\s*[-:.]?\s*(.*?)(?=\n|$)/gi;
    const headingRegex = /(?:^|\n)((?:[A-Z][A-Za-z\s]+|[A-Z\s]+):?)(?=\n|$)/gm;
    
    const pageMarkers = text.match(/--- PAGE \d+ ---/g) || [];
    const pageTexts = text.split(/--- PAGE \d+ ---\n/).filter(Boolean);
    
    let currentArticle = '';
    let currentArticleTitle = '';

    pageTexts.forEach((pageText, pageIndex) => {
      const pageNumber = pageIndex + 1;
      
      // Extract articles
      let articleMatch;
      while ((articleMatch = articleRegex.exec(pageText)) !== null) {
        currentArticle = articleMatch[1];
        currentArticleTitle = articleMatch[2].trim();
        
        sections.push({
          title: `Article ${currentArticle}: ${currentArticleTitle}`,
          content: pageText.substring(articleMatch.index, articleMatch.index + 500),
          pageNumber,
          articleNumber: currentArticle
        });
      }
      
      articleRegex.lastIndex = 0;
      
      // Extract sections
      let sectionMatch;
      while ((sectionMatch = sectionRegex.exec(pageText)) !== null) {
        const sectionId = sectionMatch[1];
        const sectionTitle = sectionMatch[2].trim();
        
        let startIndex = sectionMatch.index;
        let endIndex = pageText.length;
        
        // Find the end of this section (start of next section)
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
      
      // Extract other headings if no articles/sections found
      if (!sections.some(s => s.pageNumber === pageNumber)) {
        let headingMatch;
        while ((headingMatch = headingRegex.exec(pageText)) !== null) {
          const headingTitle = headingMatch[1].trim();
          
          let startIndex = headingMatch.index;
          let endIndex = pageText.length;
          
          // Find the end of this heading (start of next heading)
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
        
        // If still no sections found, add the whole page as a section
        if (!sections.some(s => s.pageNumber === pageNumber)) {
          sections.push({
            title: `Page ${pageNumber}`,
            content: pageText,
            pageNumber
          });
        }
      }
    });
    
    return sections;
  };
  
  const findBestMatch = (query: string, sections: DocumentSection[]): DocumentSection[] => {
    // Convert query to lowercase and extract meaningful words
    const queryWords = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .map(word => word.replace(/[^\w\s]/g, ''));
    
    if (queryWords.length === 0) return [];
    
    // Score each section based on relevance to query
    const scoredSections = sections.map(section => {
      const contentLower = section.content.toLowerCase();
      const titleLower = section.title.toLowerCase();
      
      let score = 0;
      
      // Title matches (weighted higher)
      queryWords.forEach(word => {
        if (titleLower.includes(word)) score += 5;
      });
      
      // Content matches
      queryWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = contentLower.match(regex);
        if (matches) score += matches.length;
      });
      
      // Exact phrase matches (weighted highest)
      const queryPhrase = query.toLowerCase();
      if (contentLower.includes(queryPhrase)) score += 10;
      if (titleLower.includes(queryPhrase)) score += 15;
      
      return { section, score };
    });
    
    // Sort by score (highest first) and return top 3 matches
    scoredSections.sort((a, b) => b.score - a.score);
    
    // Only return sections with a minimum score
    return scoredSections
      .filter(item => item.score > 0)
      .slice(0, 3)
      .map(item => item.section);
  };

  const generateFormattedResponse = (text: string, article: string, section: string): string => {
    const formattedAnswer = text.trim();
    const formattedReference = `ARTICLE ${article} | SECTION ${section}`;
    
    return `${formattedAnswer}\n\n${formattedReference}`;
  };

  const findRelevantInformation = async (query: string): Promise<string> => {
    // If no reference documents are available, use Mistral API directly
    if (referenceDocuments.length === 0) {
      try {
        console.log("No reference documents found, using Mistral API directly");
        const { data, error } = await supabase.functions.invoke('mistral-chat', {
          body: { query, context: "" }
        });

        if (error) throw new Error(error.message);
        
        return generateFormattedResponse(
          data.answer,
          data.article,
          data.section
        );
      } catch (err) {
        console.error("Error calling Mistral API:", err);
        return "I'm sorry, I encountered an error while processing your question. Please try again later.";
      }
    }

    try {
      const allSections: DocumentSection[] = [];
      
      // Process each reference document
      for (const doc of referenceDocuments) {
        if (!doc.text_content) {
          console.log(`Processing document: ${doc.file_name}`);
          try {
            // Get signed URL for the document
            const { data: fileData } = await supabase.storage
              .from('policy_documents')
              .createSignedUrl(doc.file_path, 3600);
              
            if (fileData?.signedUrl) {
              // Extract text from PDF
              const text = await extractTextFromPDF(fileData.signedUrl);
              
              // Update document with extracted text
              const docWithContent = { ...doc, text_content: text };
              setReferenceDocuments(prev => 
                prev.map(d => d.id === doc.id ? docWithContent : d)
              );
              
              // Extract sections from document
              const sections = extractDocumentSections(text);
              allSections.push(...sections);
              console.log(`Extracted ${sections.length} sections from ${doc.file_name}`);
            }
          } catch (err) {
            console.error(`Error extracting text from ${doc.file_name}:`, err);
          }
        } else {
          // Use already extracted sections
          const sections = extractDocumentSections(doc.text_content);
          allSections.push(...sections);
          console.log(`Using ${sections.length} sections from cached document ${doc.file_name}`);
        }
      }
      
      console.log(`Total sections available: ${allSections.length}`);
      
      // Find best matching sections for the query
      const bestMatches = findBestMatch(query, allSections);
      
      if (bestMatches.length > 0) {
        console.log(`Found ${bestMatches.length} relevant sections`);
        
        // Create context from best matching sections
        const context = bestMatches
          .map(match => `${match.title}\n${match.content}`)
          .join('\n\n');
        
        console.log("Context length: ", context.length);
        console.log("Sending query to Mistral with context");
        
        try {
          // Call Mistral API with context
          const { data, error } = await supabase.functions.invoke('mistral-chat', {
            body: { query, context }
          });

          if (error) throw new Error(error.message);
          
          // Use article/section from best match if available
          const articleRef = bestMatches[0].articleNumber || data.article;
          const sectionRef = bestMatches[0].sectionId || data.section;
          
          return generateFormattedResponse(
            data.answer,
            articleRef,
            sectionRef
          );
        } catch (err) {
          console.error("Error calling Mistral API with context:", err);
          
          // Fallback to returning the best match content directly
          return generateFormattedResponse(
            `Based on the policy documents, here's what I found:\n\n${bestMatches[0].content}`,
            bestMatches[0].articleNumber || "I",
            bestMatches[0].sectionId || "1.A"
          );
        }
      } else {
        console.log("No specific matches found. Using general context");
        
        // If no specific matches, use some general context from documents
        const generalContext = allSections
          .slice(0, 5)
          .map(section => `${section.title}\n${section.content}`)
          .join('\n\n');
          
        try {
          // Call Mistral API with general context
          const { data, error } = await supabase.functions.invoke('mistral-chat', {
            body: { query, context: generalContext }
          });

          if (error) throw new Error(error.message);
          
          return generateFormattedResponse(
            data.answer,
            data.article,
            data.section
          );
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

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: "user",
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);
    
    try {
      const botResponse = await findRelevantInformation(inputText);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: "bot",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Error generating response:", error);
      toast({
        title: "Error",
        description: "Failed to generate a response. Please try again.",
        variant: "destructive",
      });
      
      // Add error message to chat
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

  return (
    <div className="flex flex-col bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)] border border-[rgba(0,0,0,0.2)] rounded-[30px] p-4 w-full max-w-[1002px] mx-auto">
      <div className="flex flex-col gap-4 h-[350px] overflow-y-auto p-2">
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
              <p className="text-[16px] whitespace-pre-line">{message.text}</p>
              <p className="text-[12px] opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
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
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
};
