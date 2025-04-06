
import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Generate simple AI responses based on policy-related keywords
  const generateResponse = (question: string): string => {
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

  const handleSendMessage = () => {
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
    
    // Simulate response delay
    setTimeout(() => {
      try {
        const botResponse = generateResponse(inputText);
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
    }, 1000);
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
              <p className="text-[16px]">{message.text}</p>
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
