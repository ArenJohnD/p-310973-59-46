import { PolicyCard } from "./PolicyCard";

const policies = [
  "Academic Policies",
  "Attendance Policies",
  "Disipline Policies",
  "Safety Policies",
  "Extracurricular Policies",
  "Technology Use Policies",
];

export const PolicyGrid = () => {
  return (
    <section className="mt-14">
      <h2 className="text-black text-[25px] font-semibold mb-5">
        Explore Policies by Category
      </h2>
      <div className="border-b border-black w-full mb-[19px]" />
      <div className="w-full max-w-[1075px] mx-auto">
        <div className="grid grid-cols-3 gap-5 max-md:grid-cols-1">
          {policies.map((policy, index) => (
            <PolicyCard key={index} title={policy} />
          ))}
        </div>
      </div>
    </section>
  );
};
