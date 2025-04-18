import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface PolicyCardProps {
  title: string;
  id: string;
}

export const PolicyCard = ({ title, id }: PolicyCardProps) => {
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
        <Link to={`/policy/${id}`} className="flex items-center text-[rgba(49,159,67,1)] hover:text-[rgba(39,139,57,1)] font-medium transition-colors duration-200">
          View Documents
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </CardFooter>
    </Card>
  );
};
