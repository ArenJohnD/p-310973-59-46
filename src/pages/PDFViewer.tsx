
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";

interface PolicyDocument {
  id: string;
  file_path: string;
  file_name: string;
}

interface PolicyCategory {
  title: string;
}

const PDFViewer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [category, setCategory] = useState<PolicyCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchCategoryAndDocuments();
  }, [id]);

  const fetchCategoryAndDocuments = async () => {
    try {
      setLoading(true);
      
      // Fetch category information
      const { data: categoryData, error: categoryError } = await supabase
        .from('policy_categories')
        .select('title')
        .eq('id', id)
        .single();
      
      if (categoryError) throw categoryError;
      setCategory(categoryData);
      
      // Fetch documents for this category
      const { data: documentsData, error: documentsError } = await supabase
        .from('policy_documents')
        .select('id, file_name, file_path')
        .eq('category_id', id)
        .order('created_at', { ascending: false });
      
      if (documentsError) throw documentsError;
      setDocuments(documentsData || []);

      // Automatically select the first document if available
      if (documentsData && documentsData.length > 0) {
        setSelectedDocument(documentsData[0].file_path);
      }
      
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load policy documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = async (filePath: string) => {
    setSelectedDocument(filePath);
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
                View policy documents for this category
              </p>
            </section>
            
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Document list sidebar */}
              <div className="lg:w-1/4">
                <h2 className="text-xl font-semibold mb-4">Available Documents</h2>
                {documents.length > 0 ? (
                  <ul className="space-y-2">
                    {documents.map((document) => (
                      <li 
                        key={document.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedDocument === document.file_path 
                            ? "bg-green-50 border-green-300" 
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() => handleViewDocument(document.file_path)}
                      >
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-gray-500 mr-2" />
                          <span className="text-sm font-medium truncate">{document.file_name}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-8 border rounded-lg bg-gray-50">
                    <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No documents available.</p>
                  </div>
                )}
              </div>
              
              {/* PDF viewer */}
              <div className="lg:w-3/4 border rounded-lg bg-gray-50 min-h-[70vh] flex justify-center items-center">
                {selectedDocument ? (
                  <iframe
                    src={`${supabase.storage.from('policy_documents').getPublicUrl(selectedDocument).data.publicUrl}#toolbar=0`}
                    className="w-full h-[70vh] rounded-lg"
                    title="PDF Viewer"
                  />
                ) : (
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">Select a document to view</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default PDFViewer;
