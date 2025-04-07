
import { ChatBot } from "./ChatBot";

export const SearchBar = () => {
  return (
    <div className="w-full max-w-[1002px] mx-auto">
      <h2 className="text-black text-[25px] font-semibold mb-5 text-center">
        Ask Me About School Policies (Powered by Mistral AI)
      </h2>
      <ChatBot />
    </div>
  );
};
