
import { Skeleton } from "@/components/ui/skeleton";

export const MessageSkeleton = ({ type = "bot" }: { type?: "user" | "bot" }) => {
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
