
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
      
      if (data && data.length > 0) {
        // Fetch the content of each document
        const docsWithContent = await Promise.all(
          data.map(async (doc) => {
            try {
              // Get signed URL for the PDF
              const { data: fileData } = await supabase.storage
                .from('policy_documents')
                .createSignedUrl(doc.file_path, 3600);
                
              if (fileData?.signedUrl) {
                // We'll extract text client-side when needed
                return { ...doc };
              }
              return doc;
            } catch (err) {
              console.error("Error getting file URL:", err);
              return doc;
            }
          })
        );
        
        setReferenceDocuments(docsWithContent);
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

  // Function to find relevant information from reference documents based on a query
  const findRelevantInformation = async (query: string): Promise<string> => {
    // If no reference documents are available, use the default responses
    if (referenceDocuments.length === 0) {
      return generateDefaultResponse(query);
    }

    try {
      // For each document that doesn't have text_content yet, fetch and extract it
      for (let i = 0; i < referenceDocuments.length; i++) {
        const doc = referenceDocuments[i];
        if (!doc.text_content) {
          // Get signed URL for the PDF
          const { data: fileData } = await supabase.storage
            .from('policy_documents')
            .createSignedUrl(doc.file_path, 3600);
            
          if (fileData?.signedUrl) {
            try {
              // Fetch the PDF
              const response = await fetch(fileData.signedUrl);
              const pdfBlob = await response.blob();
              
              // Use a simple text extraction approach
              // In a production app, you would use a more robust PDF parsing library
              const text = await extractTextFromPDF(pdfBlob);
              
              // Update the document with its text content
              referenceDocuments[i] = { ...doc, text_content: text };
            } catch (err) {
              console.error(`Error extracting text from ${doc.file_name}:`, err);
            }
          }
        }
      }
      
      // Now all documents should have text content
      // Simple search for relevant information based on keyword matching
      const queryWords = query.toLowerCase().split(/\s+/);
      let bestMatches: { text: string, score: number }[] = [];
      
      referenceDocuments.forEach(doc => {
        if (doc.text_content) {
          // Split the document into paragraphs
          const paragraphs = doc.text_content.split(/\n\s*\n/);
          
          paragraphs.forEach(paragraph => {
            if (paragraph.trim().length > 30) { // Skip very short paragraphs
              const normalizedParagraph = paragraph.toLowerCase();
              
              // Count how many query words appear in this paragraph
              const matchScore = queryWords.filter(word => 
                word.length > 3 && normalizedParagraph.includes(word)
              ).length;
              
              if (matchScore > 0) {
                bestMatches.push({
                  text: paragraph,
                  score: matchScore
                });
              }
            }
          });
        }
      });
      
      // Sort matches by score (highest first)
      bestMatches.sort((a, b) => b.score - a.score);
      
      // Take the top 3 matches and combine them
      const topMatches = bestMatches.slice(0, 3);
      
      if (topMatches.length > 0) {
        let combinedResponse = "Based on our policy documents:\n\n";
        topMatches.forEach(match => {
          combinedResponse += match.text.trim() + "\n\n";
        });
        return combinedResponse.trim();
      } else {
        // No matches found, fall back to default responses
        return "I couldn't find specific information about that in our reference documents. " + 
               generateDefaultResponse(query);
      }
    } catch (error) {
      console.error("Error searching reference documents:", error);
      return "I'm having trouble accessing the reference documents. " + 
             generateDefaultResponse(query);
    }
  };

  // Simple function to extract text from a PDF
  // In a production app, you would use a more robust PDF parsing library
  const extractTextFromPDF = async (pdfBlob: Blob): Promise<string> => {
    // This is a placeholder - In a real application, use a PDF parsing library
    // For browser-based parsing, you could use pdf.js or other libraries
    // For this example, we'll just return a dummy extraction message
    
    // Mock extraction - in a real app, implement proper PDF text extraction
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve("This is extracted text from the PDF document. " +
                "In a real application, you would see the actual content from the document here. " +
                "You should implement a proper PDF text extraction library in production.");
      }, 500);
    });
  };

  // Generate simple AI responses based on policy-related keywords
  const generateDefaultResponse = (question: string): string => {
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes("attendance") || lowerQuestion.includes("absent")) {
      return "According to the attendance policy, students are allowed up to 3 unexcused absences per semester. More than that may affect your grades. For excused absences, you need to submit proper documentation to your instructor within 48 hours.";
    }
    
    if (lowerQuestion.includes("dress code") || lowerQuestion.includes("uniform")) {
      return "The dress code policy requires all students to wear appropriate attire. This includes no revealing clothing, offensive graphics, or gang-related items. Specific departments may have additional dress requirements.";
    }
    
    if (lowerQuestion.includes("grade") || lowerQuestion.includes("grading")) {
      return "The grading policy uses a standard scale: A (90-100%), B (80-89%), C (70-79%), D (60-69%), and F (below 60%). Some courses may be graded on a curve at the instructor's discretion.";
    }
    
    if (lowerQuestion.includes("plagiarism") || lowerQuestion.includes("cheating") || lowerQuestion.includes("academic integrity")) {
      return "Academic integrity violations, including plagiarism and cheating, are taken very seriously. Consequences range from a failing grade on the assignment to expulsion from the university, depending on severity and prior offenses.";
    }
    
    if (lowerQuestion.includes("appeal") || lowerQuestion.includes("dispute")) {
      return "To appeal a decision, you must submit a written statement to the appropriate department head within 10 days. The appeal process typically involves a review by a committee, and the decision will be communicated within two weeks.";
    }

    return "I don't have specific information about that policy yet. Please check the policy documents in our categories section or contact the administration office for more details.";
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    
    // Add user message
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
      // Find relevant information from reference documents
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
