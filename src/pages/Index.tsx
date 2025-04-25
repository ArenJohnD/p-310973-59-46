import { Header } from "@/components/Header";
import { PolicyGrid } from "@/components/PolicyGrid";
import { FAQAccordion } from "@/components/FAQAccordion";
import { ChatIcon } from "@/components/ChatIcon";

export default function Index() {
  return (
    <div className="min-h-screen bg-[#F1F1F1]">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-[1075px] mx-auto">
          <h1 className="text-black text-[35px] font-bold mb-[34px]">
            New Era University Policy Hub
          </h1>
          <p className="text-[22px] text-black font-normal leading-normal mb-10">
            Find, search, and explore New Era University's institutional 
            policies across different colleges, departments, and areas 
            of university life. Our goal is to provide accessibility 
            and transparency to all university policies.
          </p>
          
          <PolicyGrid />
          <FAQAccordion />
        </div>
      </div>
      <ChatIcon />
    </div>
  );
}
