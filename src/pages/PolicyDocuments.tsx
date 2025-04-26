import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import { Loader2, FileText, AlertCircle, ChevronLeft } from "lucide-react";
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
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-[rgba(232,255,241,1)] via-[rgba(220,255,235,1)] to-[rgba(49,159,67,0.10)]">
        <Header />
        <main className="flex-1 mt-[29px] px-4 py-8 md:px-20 md:py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
          <section className="text-center mb-8">
            <h1 className="text-black text-3xl font-bold flex items-center justify-center gap-2">
              <FileText className="h-7 w-7 text-[rgba(49,159,67,1)]" />
              {category?.title || "Policy Category"}
            </h1>
            <p className="text-black text-xl mt-2">
              View policy documents for this category
            </p>
          </section>
          <div className="flex justify-center mb-8 gap-4">
            <Button 
              onClick={() => navigate('/')} 
              className="bg-gray-500 hover:bg-gray-600 flex items-center gap-2"
            >
              <ChevronLeft className="h-5 w-5" />
              Back to Home
            </Button>
            {pdfUrl && (
              <Button
                onClick={() => window.open(pdfUrl, '_blank')}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <FileText className="h-5 w-5" />
                Open in New Tab
              </Button>
            )}
          </div>
          {pdfUrl ? (
            <div className="border rounded-lg bg-gray-50 shadow-lg overflow-hidden max-w-3xl mx-auto">
              <div className="p-4 bg-gray-100 border-b flex justify-between items-center">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-gray-700 mr-2" />
                  <h3 className="font-medium text-lg">{document?.file_name}</h3>
                </div>
                <Button
                  onClick={() => window.open(pdfUrl, '_blank')}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Open in New Tab
                </Button>
              </div>
              <iframe
                src={pdfUrl}
                title={document?.file_name}
                className="w-full min-h-[600px] bg-white border-0"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              <p className="ml-2 text-xl">Loading policy documents...</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-[rgba(232,255,241,1)] via-[rgba(220,255,235,1)] to-[rgba(49,159,67,0.10)]">
        <Header />
        <main className="flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[rgba(232,255,241,1)] via-[rgba(220,255,235,1)] to-[rgba(49,159,67,0.10)]">
      <Header />
      <main className="flex-1 mt-[29px] px-4 py-8 md:px-20 md:py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
        <section className="text-center mb-8">
          <h1 className="text-black text-3xl font-bold flex items-center justify-center gap-2">
            <FileText className="h-7 w-7 text-[rgba(49,159,67,1)]" />
            {category?.title || "Policy Category"}
          </h1>
          <p className="text-black text-xl mt-2">
            View policy documents for this category
          </p>
        </section>
        <div className="flex justify-center mb-8 gap-4">
          <Button 
            onClick={() => navigate('/')} 
            className="bg-gray-500 hover:bg-gray-600 flex items-center gap-2"
          >
            <ChevronLeft className="h-5 w-5" />
            Back to Home
          </Button>
          {pdfUrl && (
            <Button
              onClick={() => window.open(pdfUrl, '_blank')}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <FileText className="h-5 w-5" />
              Open in New Tab
            </Button>
          )}
        </div>
        {pdfUrl ? (
          <div className="border rounded-lg bg-gray-50 shadow-lg overflow-hidden max-w-3xl mx-auto">
            <div className="p-4 bg-gray-100 border-b flex justify-between items-center">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-gray-700 mr-2" />
                <h3 className="font-medium text-lg">{document?.file_name}</h3>
              </div>
              <Button
                onClick={() => window.open(pdfUrl, '_blank')}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Open in New Tab
              </Button>
            </div>
            <iframe
              src={pdfUrl}
              title={document?.file_name}
              className="w-full min-h-[600px] bg-white border-0"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <p className="ml-2 text-xl">Loading policy documents...</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default PolicyDocuments;
