import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import { Loader2, FileText, AlertCircle } from "lucide-react";
import { FileUploadManager } from "@/components/FileUploadManager";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PolicyCategory {
  id: string;
  title: string;
}

interface PolicyDocument {
  id: string;
  file_name: string;
  file_path: string;
}

const PolicyDocuments = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, refreshAdminStatus, user } = useAuth();
  const [category, setCategory] = useState<PolicyCategory | null>(null);
  const [document, setDocument] = useState<PolicyDocument | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewTracked, setViewTracked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshAdminStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track view when the page loads
  useEffect(() => {
    const trackPolicyView = async () => {
      if (id && user?.id && !viewTracked) {
        try {
          console.log("Tracking policy view for category:", id);
          
          const { error } = await supabase
            .from('policy_view_stats')
            .insert({
              category_id: id,
              viewer_id: user.id,
              viewed_at: new Date().toISOString(),
            });

          if (error) {
            console.error("Error tracking policy view:", error);
          } else {
            console.log("Policy view tracked successfully");
            setViewTracked(true);
          }
        } catch (error) {
          console.error("Failed to track policy view:", error);
        }
      } else {
        console.log("View not tracked: missing id, user, or already tracked", { id, userId: user?.id, viewTracked });
      }
    };
    
    trackPolicyView();
  }, [id, user?.id, viewTracked]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!id) {
          throw new Error("No category ID provided");
        }

        const { data: categoryData, error: categoryError } = await supabase
          .from('policy_categories')
          .select('*')
          .eq('id', id)
          .single();
          
        if (categoryError) throw categoryError;
        if (!categoryData) throw new Error("Category not found");
        
        setCategory(categoryData);

        const { data: documentData, error: documentError } = await supabase
          .from('policy_documents')
          .select('id, file_name, file_path')
          .eq('category_id', id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (documentError) throw documentError;
        
        if (documentData && documentData.length > 0) {
          setDocument(documentData[0]);
          
          const { data: fileData, error: fileError } = await supabase.storage
            .from('policy_documents')
            .createSignedUrl(documentData[0].file_path, 3600);
          
          if (fileError) throw fileError;
          
          setPdfUrl(fileData?.signedUrl || null);
        } else {
          setDocument(null);
          setPdfUrl(null);
        }
      } catch (error) {
        console.error("Error fetching policy category:", error);
        setError(error instanceof Error ? error.message : "Failed to load policy category");
        toast({
          title: "Error",
          description: "Failed to load policy category",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[rgba(233,233,233,1)]">
        <Header />
        <main className="bg-white flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <p className="ml-2 text-xl">Loading policy documents...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-[rgba(233,233,233,1)]">
        <Header />
        <main className="bg-white flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => navigate('/')} className="bg-gray-500 hover:bg-gray-600">
            Return to Home
          </Button>
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
            View policy documents for this category
          </p>
        </section>
        
        <div className="flex justify-center mb-8 gap-4">
          <Button 
            onClick={() => navigate('/')}
            className="bg-gray-500 hover:bg-gray-600"
          >
            Back to Home
          </Button>
        </div>

        {pdfUrl ? (
          <div className="border rounded-lg bg-gray-50 overflow-hidden">
            <div className="p-4 bg-gray-100 border-b flex justify-between items-center">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-gray-700 mr-2" />
                <h3 className="font-medium">{document?.file_name}</h3>
              </div>
              <Button
                onClick={() => window.open(pdfUrl, '_blank')}
                variant="outline"
                size="sm"
              >
                Open in New Tab
              </Button>
            </div>
            <iframe
              src={pdfUrl}
              className="w-full min-h-[70vh]"
              title={`${category?.title} Document`}
            />
          </div>
        ) : (
          <div className="flex justify-center items-center border rounded-lg bg-gray-50 min-h-[70vh] p-8">
            <div className="text-center">
              <p className="text-xl font-medium text-gray-700 mb-4">No Document Available</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PolicyDocuments;
