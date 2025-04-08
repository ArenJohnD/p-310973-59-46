
import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const ChatInput = ({ onSendMessage, isLoading, disabled }: ChatInputProps) => {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim() && !isLoading && !disabled) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  return (
    <div className="flex items-center gap-2 mt-4">
      <Input
        type="text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Ask about school policies..."
        className="rounded-full bg-transparent border-[rgba(0,0,0,0.2)]"
        onKeyPress={(e) => e.key === "Enter" && handleSend()}
        disabled={isLoading || disabled}
      />
      <Button 
        onClick={handleSend} 
        className="rounded-full aspect-square p-2 bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)]"
        disabled={isLoading || disabled || !inputText.trim()}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Send className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
};
