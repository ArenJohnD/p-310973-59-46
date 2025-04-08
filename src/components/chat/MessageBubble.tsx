
import ReactMarkdown from 'react-markdown';
import { Message } from '@/types/chat';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  return (
    <div 
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
  );
};
