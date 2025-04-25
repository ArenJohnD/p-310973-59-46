
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSend(input.trim());
      setInput("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t bg-white">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask a question..."
        className="min-h-[60px] resize-none"
        disabled={disabled}
      />
      <Button 
        type="submit" 
        disabled={!input.trim() || disabled}
        className="bg-[#319F43] hover:bg-[#2b8c3a]"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
