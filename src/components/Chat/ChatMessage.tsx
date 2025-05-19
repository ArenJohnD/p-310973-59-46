
import { Message } from "@/types/chat";
import { cn } from "@/lib/utils";
import { MessageCircle, User } from "lucide-react";

interface ChatMessageProps {
  message: Message;
  citations?: Array<{ content: string; similarity: number }>;
}

export function ChatMessage({ message, citations }: ChatMessageProps) {
  const isBot = message.sender === 'bot';

  return (
    <div className={cn(
      "flex gap-3 p-4",
      isBot ? "bg-gray-50" : "bg-white"
    )}>
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
        {isBot ? (
          <MessageCircle className="w-5 h-5 text-gray-600" />
        ) : (
          <User className="w-5 h-5 text-gray-600" />
        )}
      </div>
      
      <div className="flex-1 space-y-2">
        <div 
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={isBot ? { __html: message.text } : undefined}
        >
          {!isBot && message.text}
        </div>
        
        {isBot && citations && citations.length > 0 && (
          <div className="mt-2 space-y-2">
            <p className="text-sm font-medium text-gray-500">Sources:</p>
            {citations.map((citation, index) => (
              <div 
                key={index}
                className="text-xs bg-white p-2 rounded border border-gray-200"
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="font-mono text-gray-500">[{index + 1}]</p>
                  <p className="flex-1">{citation.content}</p>
                  <p className="text-gray-400">
                    {(citation.similarity * 100).toFixed(0)}% match
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
