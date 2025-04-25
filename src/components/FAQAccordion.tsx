import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question:
      "What is the attendance policy, and how many absences are allowed?",
    answer: "Details about attendance policy will be displayed here.",
  },
  {
    question: "What are the consequences of violating the dress code policy?",
    answer: "Information about dress code violations will be shown here.",
  },
  {
    question:
      "Can I appeal a disciplinary decision made under the school's policies?",
    answer: "Appeal process information will be provided here.",
  },
  {
    question:
      "What is the school's policy on academic integrity and plagiarism?",
    answer: "Academic integrity guidelines will be displayed here.",
  },
];

export const FAQAccordion = () => {
  return (
    <section className="w-full max-w-[1075px] mx-auto mt-16">
      <h2 className="text-black text-[25px] font-semibold mb-5">
        Frequently Asked Questions (FAQs)
      </h2>
      <div className="border-b border-black w-full mb-[47px]" />
      <Accordion type="single" collapsible className="w-full space-y-4">
        {faqs.map((faq, index) => (
          <AccordionItem
            key={index}
            value={`item-${index}`}
            className="bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)] border rounded-[20px] border-[rgba(0,0,0,0.2)] px-[31px] py-[25px]"
          >
            <AccordionTrigger className="text-[22px] font-semibold hover:no-underline">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-lg">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};
