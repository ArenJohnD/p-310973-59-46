
import { useEffect, useState } from "react";
import { PolicyCard } from "./PolicyCard";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type PolicyCategory = Tables<"policy_categories">;

export const PolicyGrid = () => {
  const [categories, setCategories] = useState<PolicyCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('policy_categories')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (error) throw error;
        setCategories(data || []);
      } catch (error) {
        console.error("Error fetching policy categories:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return (
    <section className="mt-14">
      <h2 className="text-black text-[25px] font-semibold mb-5">
        Explore Policies by Category
      </h2>
      <div className="border-b border-black w-full mb-[19px]" />
      <div className="w-full max-w-[1075px] mx-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <p>Loading categories...</p>
          </div>
        ) : categories.length > 0 ? (
          <div className="grid grid-cols-3 gap-5 max-md:grid-cols-1">
            {categories.map((category) => (
              <PolicyCard key={category.id} title={category.title} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No policy categories available.</p>
          </div>
        )}
      </div>
    </section>
  );
};
