
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import { FileUploadManager } from "@/components/FileUploadManager";

interface PolicyCategory {
  id: string;
  title: string;
}

const PolicyDocuments = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, refreshAdminStatus } = useAuth();
  const [category, setCategory] = useState<PolicyCategory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshAdminStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchPolicyCategory = async () => {
      try {
        setLoading(true);
        
        const { data: categoryData, error: categoryError } = await supabase
          .from('policy_categories')
          .select('*')
          .eq('id', id)
          .single();
          
        if (categoryError) throw categoryError;
        setCategory(categoryData);
      } catch (error) {
        console.error("Error fetching policy category:", error);
        toast({
          title: "Error",
          description: "Failed to load policy category",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchPolicyCategory();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[rgba(233,233,233,1)]">
        <Header />
        <main className="bg-white flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <p className="ml-2 text-xl">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[rgba(233,233,233,1)]">
      <Header />
      <main className="bg-white flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
        <section className="text-center mb-8">
          <h1 className="text-black text-3xl font-bold">
            {category?.title || "Policy Category"}
          </h1>
          <p className="text-black text-xl mt-2">
            Policy document functionality has been removed
          </p>
          {isAdmin && (
            <div className="mt-4">
              <p className="text-sm text-green-600 bg-green-50 p-2 rounded inline-block">
                Admin Mode: You have access to manage categories
              </p>
            </div>
          )}
        </section>
        
        <div className="flex justify-center mb-8 gap-4">
          <Button 
            onClick={() => navigate('/')}
            className="bg-gray-500 hover:bg-gray-600"
          >
            Back to Home
          </Button>
          
          {isAdmin && (
            <Button 
              onClick={() => navigate('/admin')}
              className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)]"
            >
              Manage in Admin
            </Button>
          )}
        </div>

        {isAdmin && (
          <FileUploadManager 
            categoryId={id || ''} 
            onFileChange={() => {}}
            existingDocument={null}
          />
        )}

        <div className="text-center p-10 border border-gray-200 rounded-lg">
          <p className="text-gray-600 mb-2">File handling functionality has been removed from the application.</p>
          <p className="text-sm text-gray-500">
            Contact your administrator for more information.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PolicyDocuments;
