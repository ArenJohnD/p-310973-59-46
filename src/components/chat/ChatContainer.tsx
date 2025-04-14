
import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { MessageSkeleton } from "./MessageSkeleton";
import { ChatInput } from "./ChatInput";
import { AutoScrollButton } from "./AutoScrollButton";
import { useChatContext } from "./ChatContext";

interface ChatContainerProps {
  loadingHistory: boolean;
  isMobile: boolean;
  isMaximized: boolean;
  showSkeletonMessages: boolean;
}

export const ChatContainer = ({ 
  loadingHistory, 
  isMobile,
  isMaximized,
  showSkeletonMessages
}: ChatContainerProps) => {
  const { messages, isLoading, sendMessage, showTypingMessage } = useChatContext();
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current && !isUserScrolled) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        setHasNewMessages(false);
      }
    } else if (isUserScrolled && messages.length > 0) {
      setHasNewMessages(true);
    }
  }, [messages, isUserScrolled]);

  const handleScrollAreaScroll = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
        setIsUserScrolled(!isAtBottom);
        
        if (isAtBottom) {
          setHasNewMessages(false);
        }
      }
    }
  };

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        setHasNewMessages(false);
        setIsUserScrolled(false);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col relative h-full">
      <ScrollArea 
        ref={scrollAreaRef} 
        className={`flex-1 w-full ${isMobile ? 'pt-10' : ''} px-2`}
        onScrollCapture={handleScrollAreaScroll}
      >
        <div className="flex flex-col gap-4 p-2">
          {loadingHistory && (
            <>
              <MessageSkeleton type="bot" />
              <MessageSkeleton type="user" />
              <MessageSkeleton type="bot" />
            </>
          )}
          
          {!loadingHistory && messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          
          {showSkeletonMessages && (
            <MessageSkeleton type="bot" />
          )}
          
          {showTypingMessage && <TypingIndicator />}
        </div>
      </ScrollArea>
      
      {hasNewMessages && (
        <AutoScrollButton onClick={scrollToBottom} className="z-10" />
      )}
      
      <ChatInput 
        onSendMessage={sendMessage} 
        isLoading={isLoading} 
      />
    </div>
  );
};
