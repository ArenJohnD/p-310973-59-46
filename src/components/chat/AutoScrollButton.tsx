
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AutoScrollButtonProps {
  onClick: () => void;
  className?: string;
}

export const AutoScrollButton = ({ onClick, className }: AutoScrollButtonProps) => {
  return (
    <Button
      variant="secondary"
      size="sm"
      className={`rounded-full shadow-md flex items-center justify-center absolute bottom-20 right-4 animate-bounce-slow ${className}`}
      onClick={onClick}
    >
      <ArrowDown className="h-4 w-4 mr-1" />
      <span className="text-xs">New messages</span>
    </Button>
  );
};
