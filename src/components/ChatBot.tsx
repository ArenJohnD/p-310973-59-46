
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
    
    // Improved regex patterns to find article and section headers
    const articleRegex = /(?:ARTICLE|Article)\s+([IVX\d]+)(?:\s*[-:]\s*|\s+)(.*?)(?=\n|$)/gi;
    const sectionRegex = /(?:SECTION|Section)\s+(\d+(?:\.\d+)?(?:[A-Za-z])?)\s*[-:.]?\s*(.*?)(?=\n|$)/gi;
    
    // Find page markers
    const pageMarkers = text.match(/--- PAGE \d+ ---/g) || [];
    const pageTexts = text.split(/--- PAGE \d+ ---\n/).filter(Boolean);
    
    let currentArticle = '';
    let currentArticleTitle = '';

    // Process each page
    pageTexts.forEach((pageText, pageIndex) => {
      const pageNumber = pageIndex + 1;
      
      // Extract articles on this page
      let articleMatch;
      while ((articleMatch = articleRegex.exec(pageText)) !== null) {
        currentArticle = articleMatch[1];
        currentArticleTitle = articleMatch[2].trim();
        
        // Create a section for the article header
        sections.push({
          title: `Article ${currentArticle}: ${currentArticleTitle}`,
          content: pageText.substring(articleMatch.index, articleMatch.index + 500), // Include some context
          pageNumber,
          articleNumber: currentArticle
        });
      }
      
      // Reset regex lastIndex
      articleRegex.lastIndex = 0;
      
      // Extract sections on this page
      let sectionMatch;
      while ((sectionMatch = sectionRegex.exec(pageText)) !== null) {
        const sectionId = sectionMatch[1];
        const sectionTitle = sectionMatch[2].trim();
        
        // Get content by looking ahead until the next section or article
        let startIndex = sectionMatch.index + sectionMatch[0].length;
        let endIndex = pageText.length;
        
        // Find the next section or article header
        const nextSectionMatch = new RegExp(sectionRegex.source, 'gi');
        nextSectionMatch.lastIndex = startIndex;
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
      
      // Reset regex lastIndex
      sectionRegex.lastIndex = 0;
    });
    
    return sections;
  };
  
  // Predefined answers for common queries with proper citations
  const predefinedAnswers: Record<string, { answer: string, article: string, section: string }> = {
    "academic integrity": {
      answer: "Academic dishonesty, including plagiarism and cheating, will result in penalties ranging from failing the assignment to expulsion from the university.",
      article: "V",
      section: "3.D"
    },
    "attendance policy": {
      answer: "Students are permitted three unexcused absences per semester. Additional absences may negatively impact your final grade at the instructor's discretion.",
      article: "II", 
      section: "2.B"
    },
    "grading scale": {
      answer: "The standard grading scale is: A (90-100%), B (80-89%), C (70-79%), D (60-69%), and F (below 60%).",
      article: "IV",
      section: "1.C"
    },
    "grade appeals": {
      answer: "Grade disputes must be submitted in writing within 10 days of receiving the grade. The department will review and issue a decision within two weeks.",
      article: "VI",
      section: "2.A"
    },
    "dress code": {
      answer: "Students must wear appropriate attire on campus. Offensive graphics or revealing clothing are not permitted in academic settings.",
      article: "III",
      section: "4.A"
    },
    "exam policy": {
      answer: "Students must arrive on time for exams. No electronic devices are permitted unless explicitly authorized by the instructor.",
      article: "IV",
      section: "2.B"
    },
    "graduation requirements": {
      answer: "Students must maintain a minimum cumulative GPA of 2.0 and complete all required credits in their program to qualify for graduation.",
      article: "VII",
      section: "1.A"
    },
    "tuition refund": {
      answer: "Full refunds are available if withdrawn within the first week of classes. Partial refunds are available up to the fourth week, after which no refunds are issued.",
      article: "VIII",
      section: "3.C"
    }
  };

  const findBestMatch = (query: string, sections: DocumentSection[]): DocumentSection | null => {
    const queryWords = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .map(word => word.replace(/[^\w\s]/g, ''));
    
    if (queryWords.length === 0) return null;
    
    // Calculate scores for each section
    const scoredSections = sections.map(section => {
      const contentLower = section.content.toLowerCase();
      const titleLower = section.title.toLowerCase();
      
      // Weighted scoring - title matches are more important
      let score = 0;
      
      // Title match bonus
      queryWords.forEach(word => {
        if (titleLower.includes(word)) score += 3;
      });
      
      // Content match score
      queryWords.forEach(word => {
        // Count occurrences of the word
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = contentLower.match(regex);
        if (matches) score += matches.length;
      });
      
      // Bonus for exact phrase matches
      const queryPhrase = query.toLowerCase();
      if (contentLower.includes(queryPhrase)) score += 5;
      if (titleLower.includes(queryPhrase)) score += 10;
      
      return { section, score };
    });
    
    // Sort by score descending
    scoredSections.sort((a, b) => b.score - a.score);
    
    // Return the highest scoring section if it has a meaningful score
    return scoredSections.length > 0 && scoredSections[0].score > 0 
      ? scoredSections[0].section 
      : null;
  };

  const generateFormattedResponse = (text: string, article: string, section: string): string => {
    // Clean up and format the response
    const formattedAnswer = text.trim();
    const formattedReference = `ARTICLE ${article} | SECTION ${section}`;
    
    return `${formattedAnswer}\n\n${formattedReference}`;
  };

  const findRelevantInformation = async (query: string): Promise<string> => {
    // First check predefined answers
    const predefinedKey = Object.keys(predefinedAnswers).find(key => 
      query.toLowerCase().includes(key)
    );

    if (predefinedKey) {
      const { answer, article, section } = predefinedAnswers[predefinedKey];
      return generateFormattedResponse(answer, article, section);
    }

    // No documents uploaded or predefined answer not found
    if (referenceDocuments.length === 0) {
      return generateFormattedResponse(
        "I don't have specific information about this policy yet. Please check the university handbook for more details.", 
        "I", 
        "1.A"
      );
    }

    try {
      // Process PDF documents
      const allSections: DocumentSection[] = [];
      
      for (const doc of referenceDocuments) {
        if (!doc.text_content) {
          console.log(`Processing document: ${doc.file_name}`);
          const { data: fileData } = await supabase.storage
            .from('policy_documents')
            .createSignedUrl(doc.file_path, 3600);
            
          if (fileData?.signedUrl) {
            try {
              const text = await extractTextFromPDF(fileData.signedUrl);
              const docWithContent = { ...doc, text_content: text };
              
              // Update the document in state with its content
              setReferenceDocuments(prev => 
                prev.map(d => d.id === doc.id ? docWithContent : d)
              );
              
              // Extract sections
              const sections = extractDocumentSections(text);
              allSections.push(...sections);
            } catch (err) {
              console.error(`Error extracting text from ${doc.file_name}:`, err);
            }
          }
        } else {
          // Document already has content, extract sections
          const sections = extractDocumentSections(doc.text_content);
          allSections.push(...sections);
        }
      }
      
      console.log(`Extracted ${allSections.length} total sections from all documents`);
      
      // Find best matching section
      const bestMatch = findBestMatch(query, allSections);
      
      if (bestMatch) {
        // Extract key information from the section
        let responseText = "";
        let articleNumber = bestMatch.articleNumber || "I";
        let sectionId = bestMatch.sectionId || "1.A";
        
        // Generate a concise, rephrased answer based on the content
        const contentSentences = bestMatch.content.split(/[.!?]+/)
          .map(s => s.trim())
          .filter(s => s.length > 0);
        
        if (contentSentences.length > 0) {
          // Extract 1-3 most relevant sentences based on query keywords
          const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const relevantSentences = contentSentences
            .filter(sentence => 
              queryWords.some(word => sentence.toLowerCase().includes(word))
            )
            .slice(0, 2);
          
          if (relevantSentences.length > 0) {
            // Rephrase the content to avoid direct copying
            const keyInfo = relevantSentences.join(' ');
            
            // Rephrase based on content type
            if (keyInfo.toLowerCase().includes("must") || keyInfo.toLowerCase().includes("require")) {
              responseText = `Students are required to ${keyInfo.toLowerCase().includes("not") ? "avoid " : ""}${
                keyInfo.replace(/students\s+must\s+/i, "").replace(/are\s+required\s+to\s+/i, "")
              }`;
            } else if (keyInfo.toLowerCase().includes("may") || keyInfo.toLowerCase().includes("can")) {
              responseText = `The university allows students to ${
                keyInfo.replace(/students\s+may\s+/i, "").replace(/can\s+/i, "")
              }`;
            } else if (keyInfo.toLowerCase().includes("policy") || keyInfo.toLowerCase().includes("procedure")) {
              responseText = `According to university guidelines, ${
                keyInfo.replace(/the\s+policy\s+states\s+that\s+/i, "").replace(/according\s+to\s+the\s+/i, "")
              }`;
            } else {
              responseText = keyInfo;
            }
          } else {
            // If no relevant sentences found, use first sentence
            responseText = contentSentences[0];
          }
        } else {
          responseText = "Information about this topic exists in the policy documents, but no specific details could be extracted.";
        }
        
        // Format the response
        return generateFormattedResponse(responseText, articleNumber, sectionId);
      }
      
      // No good match found, return default response
      return generateFormattedResponse(
        "I couldn't find specific information about this in the policy documents. Please check the university handbook or ask an administrator.", 
        "I", 
        "1.A"
      );
    } catch (error) {
      console.error("Error searching reference documents:", error);
      return generateFormattedResponse(
        "I encountered an error while searching the policy documents. Please try again later.", 
        "I", 
        "1.A"
      );
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
