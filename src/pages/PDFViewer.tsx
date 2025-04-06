
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { FileUploadManager } from "@/components/FileUploadManager";

interface PolicyCategory {
  title: string;
}

const PDFViewer = () => {
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
    if (!id) return;
    fetchCategory();
  }, [id]);

  const fetchCategory = async () => {
    try {
      setLoading(true);
      
      const { data: categoryData, error: categoryError } = await supabase
        .from('policy_categories')
        .select('title')
        .eq('id', id)
        .single();
      
      if (categoryError) throw categoryError;
      setCategory(categoryData);
      
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load policy category. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[rgba(233,233,233,1)]">
      <Header />
      <main className="bg-white flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
        <Button 
          variant="outline" 
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Categories
        </Button>
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : (
          <>
            <section className="text-center mb-8">
              <h1 className="text-black text-3xl font-bold mb-2">
                {category?.title} Documents
              </h1>
              <p className="text-gray-600">
                File viewing functionality has been removed
              </p>
              {isAdmin && (
                <div className="mt-4">
                  <p className="text-sm text-green-600 bg-green-50 p-2 rounded inline-block">
                    Admin Mode: You have access to manage categories
                  </p>
                </div>
              )}
            </section>
            
            {isAdmin && (
              <FileUploadManager 
                categoryId={id || ''} 
                onFileChange={() => {}}
              />
            )}
            
            <div className="flex justify-center items-center border rounded-lg bg-gray-50 min-h-[70vh] p-8">
              <div className="text-center">
                <p className="text-xl font-medium text-gray-700 mb-4">File Viewing Disabled</p>
                <p className="text-gray-500 max-w-md mx-auto">
                  The document viewing functionality has been removed from the application.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default PDFViewer;
