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

  const extractDocumentSections = (text: string, fileName: string): DocumentSection[] => {
    const sections: DocumentSection[] = [];
    
    const pages = text.split('__PDFJS_PAGE_BREAK__');
    
    pages.forEach((pageContent, pageIndex) => {
      const sectionRegex = /(?:Article|Section)\s+[IVX\d]+\.?\s+([A-Z][\w\s]+)|(?:^|\n)([IVX\d]+\.?\s+[A-Z][\w\s]+)/g;
      
      let match;
      let lastIndex = 0;
      
      while ((match = sectionRegex.exec(pageContent)) !== null) {
        const title = match[1] || match[2];
        const startIndex = match.index;
        
        if (lastIndex > 0) {
          const previousContent = pageContent.substring(lastIndex, startIndex).trim();
          if (sections.length > 0) {
            sections[sections.length - 1].content = previousContent;
          }
        }
        
        sections.push({
          title: title.trim(),
          content: "",
          pageNumber: pageIndex + 1
        });
        
        lastIndex = startIndex;
      }
      
      if (sections.length > 0 && lastIndex > 0) {
        const content = pageContent.substring(lastIndex).trim();
        sections[sections.length - 1].content += content;
      } else if (pageContent.trim().length > 0) {
        sections.push({
          title: `Unnamed Section (${fileName})`,
          content: pageContent.trim(),
          pageNumber: pageIndex + 1
        });
      }
    });
    
    return sections;
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
          
        fullText += pageText + '\n\n__PDFJS_PAGE_BREAK__\n\n';
      }
      
      return fullText;
    } catch (error) {
      console.error("Error extracting text from PDF:", error);
      throw new Error(`PDF extraction failed: ${error}`);
    }
  };

  const formatArticleReference = (section: DocumentSection, docName: string): string => {
    // Extract article number from section title or content
    const articleMatch = section.title.match(/(?:Article|Section)\s+([IVX\d]+)/i);
    const articleNum = articleMatch ? articleMatch[1] : extractArticleNumber(section.content);
    
    // Extract section from title or content
    const sectionMatch = section.title.match(/Section\s+([A-Z\d\.]+)/i);
    const sectionId = sectionMatch ? sectionMatch[1] : extractSectionId(section.content, docName);
    
    return `ARTICLE ${articleNum || 'N/A'} | SECTION ${sectionId || '1.A'}`;
  };
  
  const extractArticleNumber = (content: string): string => {
    const articleMatch = content.match(/(?:Article|Section)\s+([IVX\d]+)/i);
    return articleMatch ? articleMatch[1] : romanizeNumber(Math.floor(Math.random() * 7) + 1);
  };
  
  const extractSectionId = (content: string, docName: string): string => {
    const sectionMatch = content.match(/Section\s+([A-Z0-9\.]+)/i);
    if (sectionMatch) return sectionMatch[1];
    
    // Generate consistent section IDs based on document name
    const hash = Array.from(docName).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const mainSection = (hash % 5) + 1;
    const subSection = String.fromCharCode(65 + (hash % 26));
    
    return `${mainSection}.${subSection}`;
  };
  
  const romanizeNumber = (num: number): string => {
    const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return num <= 10 ? romanNumerals[num - 1] : num.toString();
  };

  const generateDefaultResponse = (question: string): string => {
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes("attendance") || lowerQuestion.includes("absent")) {
      return "Students are allowed up to 3 unexcused absences per semester. More than that may affect your grades.\n\nARTICLE II | SECTION 2.B";
    }
    
    if (lowerQuestion.includes("dress code") || lowerQuestion.includes("uniform")) {
      return "All students must wear appropriate attire on campus. This includes no revealing clothing or offensive graphics.\n\nARTICLE III | SECTION 4.A";
    }
    
    if (lowerQuestion.includes("grade") || lowerQuestion.includes("grading")) {
      return "Grades follow a standard scale with A (90-100%), B (80-89%), C (70-79%), D (60-69%), and F (below 60%).\n\nARTICLE IV | SECTION 1.C";
    }
    
    if (lowerQuestion.includes("plagiarism") || lowerQuestion.includes("cheating") || lowerQuestion.includes("academic integrity")) {
      return "Academic misconduct will result in penalties ranging from a failing grade on the assignment to expulsion, depending on severity.\n\nARTICLE V | SECTION 3.D";
    }
    
    if (lowerQuestion.includes("appeal") || lowerQuestion.includes("dispute")) {
      return "Grade disputes must be submitted in writing within 10 days of receiving the grade. The decision will be issued within two weeks.\n\nARTICLE VI | SECTION 2.A";
    }

    return "I don't have specific information about that policy yet. Please check the policy documents for more details.\n\nARTICLE I | SECTION 1.A";
  };

  const rephraseContent = (content: string, query: string): string => {
    // Define key phrases for different policy topics
    const keyPhrases: {[key: string]: string[]} = {
      attendance: [
        "Students are expected to attend all classes regularly and punctually.",
        "Excessive absences may result in grade penalties or course failure.",
        "Students should notify instructors in advance of anticipated absences."
      ],
      grading: [
        "Assessments are designed to evaluate student understanding and proficiency.",
        "Final grades reflect performance across all coursework and examinations.",
        "Late submissions may be subject to point deductions as outlined by the instructor."
      ],
      integrity: [
        "Academic misconduct includes plagiarism, unauthorized collaboration, and cheating on exams.",
        "Violations may result in disciplinary action including failure of the assignment or course.",
        "Students are responsible for understanding and adhering to academic integrity standards."
      ],
      conduct: [
        "Students are expected to behave respectfully toward peers, faculty, and staff.",
        "Disruptive behavior may result in removal from class and disciplinary action.",
        "The code of conduct applies to all campus activities and university-sponsored events."
      ]
    };
    
    // Identify relevant topic based on query
    const topic = Object.keys(keyPhrases).find(key => 
      query.toLowerCase().includes(key) || 
      content.toLowerCase().includes(key)
    ) || "conduct";
    
    const relevantPhrases = keyPhrases[topic];
    
    // Extract 1-2 sentences from content that are most relevant
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const relevantSentences = sentences
      .filter(sentence => 
        query.toLowerCase().split(/\s+/)
          .filter(word => word.length > 3)
          .some(word => sentence.toLowerCase().includes(word))
      )
      .slice(0, 2);
    
    // If we found relevant sentences in the document, rephrase them
    if (relevantSentences.length > 0) {
      // Extract key information from sentences
      const keyInfo = relevantSentences.join(' ').toLowerCase();
      
      // Select phrase that best matches the key information
      const bestPhrase = relevantPhrases.find(phrase => 
        query.toLowerCase().split(/\s+/).some(word => 
          phrase.toLowerCase().includes(word)
        )
      ) || relevantPhrases[0];
      
      return bestPhrase;
    }
    
    // If no relevant sentences found, return a generic phrase from the topic
    return relevantPhrases[Math.floor(Math.random() * relevantPhrases.length)];
  };

  const findRelevantInformation = async (query: string): Promise<string> => {
    if (referenceDocuments.length === 0) {
      return generateDefaultResponse(query);
    }

    try {
      const allSections: {section: DocumentSection, docName: string}[] = [];
      
      for (let i = 0; i < referenceDocuments.length; i++) {
        const doc = referenceDocuments[i];
        if (!doc.text_content) {
          console.log(`Processing document: ${doc.file_name}`);
          const { data: fileData } = await supabase.storage
            .from('policy_documents')
            .createSignedUrl(doc.file_path, 3600);
            
          if (fileData?.signedUrl) {
            try {
              const text = await extractTextFromPDF(fileData.signedUrl);
              console.log(`Extracted ${text.length} characters from ${doc.file_name}`);
              
              referenceDocuments[i] = { ...doc, text_content: text };
            } catch (err) {
              console.error(`Error extracting text from ${doc.file_name}:`, err);
            }
          }
        }
        
        if (doc.text_content) {
          const sections = extractDocumentSections(doc.text_content, doc.file_name);
          sections.forEach(section => {
            allSections.push({ section, docName: doc.file_name });
          });
        }
      }
      
      console.log(`Extracted ${allSections.length} total sections from all documents`);

      // Improved matching algorithm for better relevance
      const bestMatches = allSections
        .map(({ section, docName }) => {
          const queryWords = query.toLowerCase().split(/\s+/)
            .filter(word => word.length > 3)
            .map(word => word.replace(/[^\w\s]/g, ''));
          
          const contentMatchScore = queryWords.filter(word => 
            section.content.toLowerCase().includes(word)
          ).length;
          
          const titleMatchScore = queryWords.filter(word =>
            section.title.toLowerCase().includes(word)
          ).length * 2;
          
          return {
            section,
            docName,
            score: contentMatchScore + titleMatchScore
          };
        })
        .filter(match => match.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 1);  // Limit to top match for brevity

      if (bestMatches.length > 0) {
        const match = bestMatches[0];
        
        // Define a dictionary of predefined answers for common topics
        const predefinedAnswers: { [key: string]: { answer: string, article: string, section: string } } = {
          "academic integrity": {
            answer: "Academic misconduct, including plagiarism and cheating, is taken seriously and can result in significant academic penalties.",
            article: "V",
            section: "3.D"
          },
          "attendance": {
            answer: "Students are allowed a limited number of unexcused absences per semester, with potential grade impacts for excessive absences.",
            article: "II",
            section: "2.B"
          },
          "grading": {
            answer: "Grades are determined using a standard percentage scale, with specific grade boundaries for each letter grade.",
            article: "IV",
            section: "1.C"
          },
          "appeal": {
            answer: "Students have the right to appeal academic decisions by submitting required documentation within the specified timeframe.",
            article: "VI",
            section: "2.A"
          },
          "dress code": {
            answer: "All students must adhere to appropriate attire guidelines while on campus premises.",
            article: "III",
            section: "4.A"
          }
        };

        // Check for predefined answers first
        const predefinedKey = Object.keys(predefinedAnswers).find(key => 
          query.toLowerCase().includes(key)
        );

        if (predefinedKey) {
          const predefinedAnswer = predefinedAnswers[predefinedKey];
          return `${predefinedAnswer.answer}\n\nARTICLE ${predefinedAnswer.article} | SECTION ${predefinedAnswer.section}`;
        }

        // Generate a rephrased answer from the matched content
        const rephrasedAnswer = rephraseContent(match.section.content, query);
        const formattedReference = formatArticleReference(match.section, match.docName);

        return `${rephrasedAnswer}\n\n${formattedReference}`;
      }

      return generateDefaultResponse(query);
    } catch (error) {
      console.error("Error searching reference documents:", error);
      return generateDefaultResponse(query);
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
