
import { Header } from "@/components/Header";
import { SearchBar } from "@/components/SearchBar";
import { PolicyGrid } from "@/components/PolicyGrid";
import { FAQAccordion } from "@/components/FAQAccordion";
import { useEffect } from "react";

const Index = () => {
  // Scroll to top when the component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[rgba(233,233,233,1)]">
      <Header />
      <main className="bg-white flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
        <section className="text-center mb-12">
          <h1 className="text-black text-3xl font-bold">
            Welcome to NEUPoliSeek!
          </h1>
          <p className="text-black text-[28px] font-semibold mt-2">
            Find, Understand, and Navigate School Policies with Ease.
          </p>
        </section>

        <section className="mt-[50px]">
          <SearchBar />
        </section>

        <PolicyGrid />

        <FAQAccordion />
      </main>
    </div>
  );
};

export default Index;
