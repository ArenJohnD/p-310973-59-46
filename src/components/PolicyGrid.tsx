
import { useEffect, useState } from "react";
import { PolicyCard } from "./PolicyCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";

interface PolicyCategory {
  id: string;
  title: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export const PolicyGrid = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<PolicyCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        console.log("Fetching policy categories");
        
        const { data, error } = await supabase
          .from('policy_categories')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (error) {
          console.error("Error fetching policy categories:", error);
          throw error;
        }
        
        console.log("Retrieved categories:", data?.length);
        setCategories(data || []);
      } catch (error) {
        console.error("Error fetching policy categories:", error);
        toast({
          title: "Error",
          description: "Failed to load policy categories. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Function to track category views
  const trackCategoryView = async (categoryId: string) => {
    try {
      console.log("Tracking view for category:", categoryId);
      
      // Only track if user is logged in
      if (!user) {
        console.log("User not logged in, view not tracked");
        return;
      }
      
      const { error } = await supabase
        .from('policy_view_stats')
        .insert({
          category_id: categoryId,
          viewer_id: user.id,
          viewed_at: new Date().toISOString(),
        });

      if (error) {
        console.error("Error tracking category view:", error);
      } else {
        console.log("Category view tracked successfully");
      }
    } catch (error) {
      console.error("Failed to track category view:", error);
    }
  };

  // Wrap PolicyCard with click handler to track views
  const PolicyCardWithTracking = ({ title, id }: { title: string, id: string }) => {
    const handleClick = () => {
      trackCategoryView(id);
    };

    return (
      <div onClick={handleClick}>
        <PolicyCard title={title} id={id} />
      </div>
    );
  };

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
          <div className="grid grid-cols-3 gap-8 max-md:grid-cols-1">
            {categories.map((category) => (
              <PolicyCardWithTracking key={category.id} title={category.title} id={category.id} />
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
