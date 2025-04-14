
import { cn } from "@/lib/utils";

export const TypingIndicator = ({ className }: { className?: string }) => (
  <div className={cn("flex justify-start", className)}>
    <div className="max-w-[80%] rounded-[20px] px-6 py-3 bg-[rgba(49,159,67,1)] text-white">
      <div className="flex items-center space-x-1">
        <div className="typing-dot w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: "0ms" }}></div>
        <div className="typing-dot w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: "150ms" }}></div>
        <div className="typing-dot w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: "300ms" }}></div>
      </div>
    </div>
  </div>
);
