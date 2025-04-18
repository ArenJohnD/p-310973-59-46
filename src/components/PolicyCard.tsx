
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface PolicyCardProps {
  title: string;
  id: string;
}

export const PolicyCard = ({ title, id }: PolicyCardProps) => {
  const { user } = useAuth();

  const trackCategoryView = async () => {
    try {
      if (!user) return;

      console.log("Tracking view for policy category:", id);
      
      const { error } = await supabase
        .from('policy_views')
        .insert({
          category_id: id,
          policy_id: id, // Using the same ID for both as we don't have a specific document yet
          viewer_id: user.id,
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

  return (
    <Card className="bg-white border-black shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-black text-xl font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-gray-600">
          Explore the policies and guidelines under this category.
        </CardDescription>
      </CardContent>
      <CardFooter className="justify-end">
        <Link 
          to={`/policy/${id}`} 
          className="flex items-center text-[rgba(49,159,67,1)] hover:text-[rgba(39,139,57,1)] font-medium transition-colors duration-200"
          onClick={trackCategoryView}
        >
          View Documents
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </CardFooter>
    </Card>
  );
};
