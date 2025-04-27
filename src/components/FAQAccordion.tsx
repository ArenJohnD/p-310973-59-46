import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

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
    <section className="w-full max-w-[1075px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-600/90 mt-1">
            Find answers to common questions about our policies
          </p>
        </div>
        <div className="h-10 w-10 rounded-full bg-[rgba(49,159,67,0.15)] backdrop-blur-sm flex items-center justify-center flex-shrink-0 ml-4">
          <HelpCircle className="h-6 w-6 text-[rgba(49,159,67,1)]" />
        </div>
      </div>

      <Accordion type="single" collapsible className="w-full space-y-4">
        {faqs.map((faq, index) => (
          <AccordionItem
            key={index}
            value={`item-${index}`}
            className="bg-white/80 backdrop-blur-sm border-transparent rounded-lg px-4 sm:px-6 py-4 data-[state=open]:shadow-sm transition-all duration-200 hover:bg-white/90"
          >
            <AccordionTrigger className="text-base sm:text-lg font-semibold hover:no-underline text-left">
              <div className="flex gap-3 items-start">
                <span className="text-[rgba(49,159,67,1)] text-sm font-medium bg-[rgba(49,159,67,0.15)] backdrop-blur-sm px-2 py-0.5 rounded">
                  Q{index + 1}
                </span>
                <span className="flex-grow">{faq.question}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-base text-gray-600/90 pt-2 pl-11">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};