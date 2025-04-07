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
    const policyRegex = /(?:Policy|POLICY)\s+(?:Number|NUMBER)?\s*[:#]?\s*(\d+(?:\.\d+)?)/gi;
    
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
        
        // Find the end of this article (start of next article or end of page)
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
      
      // Extract policy numbers
      let policyMatch;
      while ((policyMatch = policyRegex.exec(pageText)) !== null) {
        const policyId = policyMatch[1];
        
        // Extract 500 characters before and after the policy number to capture context
        const startPos = Math.max(0, policyMatch.index - 500);
        const endPos = Math.min(pageText.length, policyMatch.index + 1000);
        const policyContext = pageText.substring(startPos, endPos);
        
        // Try to extract a title from the context
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
        
        // If still no sections found, split page into manageable chunks
        if (!sections.some(s => s.pageNumber === pageNumber)) {
          // Split into chunks of roughly 1000 characters with paragraph breaks
          const paragraphs = pageText.split(/\n\s*\n/);
          let currentChunk = '';
          let chunkNumber = 1;
          
          paragraphs.forEach(paragraph => {
            if (currentChunk.length + paragraph.length > 1000) {
              // Store current chunk as a section
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
          
          // Add the last chunk if it has content
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
    // Normalize and tokenize the query
    const queryNormalized = query.toLowerCase().replace(/[^\w\s]/g, '');
    const queryTokens = queryNormalized
      .split(/\s+/)
      .filter(word => word.length > 2)
      .map(word => word.trim());
      
    if (queryTokens.length === 0) return [];
    
    // Important keywords that might indicate relevance
    const importantKeywords = [
      'policy', 'procedure', 'regulation', 'rule', 'guideline', 
      'requirement', 'mandatory', 'prohibited', 'permission', 'approval',
      'student', 'faculty', 'staff', 'admin', 'academic', 'conduct', 'discipline'
    ];
    
    // Weight query tokens that match important keywords higher
    const weightedQueryTokens = queryTokens.map(token => ({
      token,
      weight: importantKeywords.includes(token) ? 2.0 : 1.0
    }));
    
    // Score each section based on relevance to query
    const scoredSections = sections.map(section => {
      const contentNormalized = section.content.toLowerCase().replace(/[^\w\s]/g, '');
      const titleNormalized = section.title.toLowerCase().replace(/[^\w\s]/g, '');
      
      let score = 0;
      
      // Title matches (weighted higher)
      weightedQueryTokens.forEach(({ token, weight }) => {
        if (titleNormalized.includes(token)) {
          score += 10 * weight;
          
          // Boost score for exact phrase matches in title
          if (titleNormalized.includes(queryNormalized)) {
            score += 30;
          }
        }
      });
      
      // Content matches
      weightedQueryTokens.forEach(({ token, weight }) => {
        // Count occurrences
        const regex = new RegExp(`\\b${token}\\b`, 'gi');
        const matches = (section.content.match(regex) || []).length;
        
        // Add to score, with higher weight for more matches (logarithmic scaling)
        if (matches > 0) {
          score += Math.min(15, 5 + 2 * Math.log2(matches + 1)) * weight;
        }
      });
      
      // Boost score for sections with article and section numbers (more specific)
      if (section.articleNumber && section.sectionId) {
        score *= 1.2;
      }
      
      // Exact phrase matches (weighted highest)
      if (contentNormalized.includes(queryNormalized)) {
        score += 20;
      }
      
      // Proximity boost - if query terms appear close together
      if (queryTokens.length > 1) {
        const proximityBonus = calculateProximityScore(contentNormalized, queryTokens);
        score += proximityBonus;
      }
      
      return { section, score };
    });
    
    // Sort by score (highest first)
    scoredSections.sort((a, b) => b.score - a.score);
    
    // Only return sections with a minimum score
    const significantMatches = scoredSections
      .filter(item => item.score > 5)
      .slice(0, 5)  // Get top 5 matches
      .map(item => item.section);
      
    console.log(`Found ${significantMatches.length} significant matches for query`);
    return significantMatches;
  };
  
  // Helper function to calculate proximity score
  const calculateProximityScore = (text: string, queryTokens: string[]): number => {
    let proximityScore = 0;
    
    // Find positions of all query tokens in the text
    const positions: Record<string, number[]> = {};
    
    queryTokens.forEach(token => {
      positions[token] = [];
      let pos = text.indexOf(token);
      while (pos !== -1) {
        positions[token].push(pos);
        pos = text.indexOf(token, pos + 1);
      }
    });
    
    // Check if all tokens are present
    const allTokensPresent = queryTokens.every(token => positions[token].length > 0);
    if (!allTokensPresent) return 0;
    
    // Find the smallest window containing all tokens
    const allPositions: {token: string, pos: number}[] = [];
    Object.entries(positions).forEach(([token, poses]) => {
      poses.forEach(pos => {
        allPositions.push({ token, pos });
      });
    });
    
    allPositions.sort((a, b) => a.pos - b.pos);
    
    // Calculate minimum window size containing all unique tokens
    let minWindow = Number.MAX_SAFE_INTEGER;
    
    for (let i = 0; i < allPositions.length; i++) {
      const tokensInWindow = new Set<string>();
      tokensInWindow.add(allPositions[i].token);
      
      for (let j = i + 1; j < allPositions.length; j++) {
        tokensInWindow.add(allPositions[j].token);
        
        // If we have all tokens in this window
        if (tokensInWindow.size === queryTokens.length) {
          const windowSize = allPositions[j].pos - allPositions[i].pos + 1;
          minWindow = Math.min(minWindow, windowSize);
          break;
        }
      }
    }
    
    // Award proximity bonus based on how close the terms appear
    if (minWindow < 100) {
      proximityScore = 15;  // Very close
    } else if (minWindow < 300) {
      proximityScore = 10;  // Moderately close
    } else if (minWindow < 600) {
      proximityScore = 5;   // In same general area
    }
    
    return proximityScore;
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
        
        // Just return the answer without article/section formatting
        return data.answer;
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
          
          // Return just the answer without article/section formatting
          return data.answer;
        } catch (err) {
          console.error("Error calling Mistral API with context:", err);
          
          // Fallback to returning the best match content directly
          return `Based on the policy documents, here's what I found:\n\n${bestMatches[0].content}`;
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
          
          // Return just the answer without article/section formatting
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
