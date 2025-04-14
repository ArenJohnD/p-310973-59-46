
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";

export const MessageSkeleton = ({ type = "bot" }: { type?: "user" | "bot" }) => {
  const [isVisible, setIsVisible] = useState(true);
  
  // Add an effect to unmount the skeleton after some time if it gets "stuck"
  useEffect(() => {
    // Set a timeout to automatically hide the skeleton after 10 seconds
    // This serves as a fallback in case the parent component fails to unmount it
    const timeoutId = setTimeout(() => {
      setIsVisible(false);
    }, 10000);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, []);
  
  if (!isVisible) {
    return null;
  }
  
  return (
    <div className={`flex ${type === "bot" ? "justify-start" : "justify-end"}`}>
      <div 
        className={`max-w-[80%] rounded-[20px] px-4 py-3 ${
          type === "bot" ? "bg-[rgba(49,159,67,0.15)]" : "bg-[rgba(49,159,67,1)] text-white"
        }`}
      >
        <div className="flex flex-col gap-2">
          <Skeleton className={`h-4 w-48 ${type === "bot" ? "bg-gray-300" : "bg-green-300"}`} />
          <Skeleton className={`h-4 w-32 ${type === "bot" ? "bg-gray-300" : "bg-green-300"}`} />
          {type === "bot" && <Skeleton className={`h-4 w-24 bg-gray-300`} />}
        </div>
      </div>
    </div>
  );
};
