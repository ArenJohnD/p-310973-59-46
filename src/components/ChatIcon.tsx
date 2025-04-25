import { MessageCircle } from "lucide-react";

export const ChatIcon = () => {
  return (
    <div 
      className="fixed bottom-6 right-6 bg-[#319F43] p-4 rounded-full cursor-pointer hover:bg-[#2b8c3a] transition-colors shadow-lg z-50"
      style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <MessageCircle className="h-6 w-6 text-white" />
    </div>
  );
}; 