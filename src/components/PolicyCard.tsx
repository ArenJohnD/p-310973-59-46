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
    <Card className="group bg-white/80 backdrop-blur-sm border-transparent shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-[250px] relative overflow-hidden hover:bg-white/90">
      <div className="absolute top-0 left-0 w-1 h-full bg-[rgba(49,159,67,1)] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-semibold text-gray-900 group-hover:text-[rgba(49,159,67,1)] transition-colors duration-300">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow pb-2">
        <CardDescription className="text-gray-600">
          Explore the policies and guidelines under this category.
        </CardDescription>
      </CardContent>
      <CardFooter className="justify-end mt-auto pt-4 border-t border-gray-100/20">
        <Link 
          to={`/policy/${id}`} 
          className="flex items-center text-[rgba(49,159,67,1)] hover:text-[rgba(39,139,57,1)] font-medium transition-all duration-200 group-hover:translate-x-1"
          onClick={trackCategoryView}
        >
          View Document
          <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </CardFooter>
    </Card>
  );
};
