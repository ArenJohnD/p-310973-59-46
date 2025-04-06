
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { FileUploadManager } from "@/components/FileUploadManager";

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
  const { isAdmin, refreshAdminStatus } = useAuth();
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [category, setCategory] = useState<PolicyCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    // When component mounts, refresh admin status
    refreshAdminStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchCategoryAndDocuments();
  }, [id, loadAttempt]);

  useEffect(() => {
    // Get signed URL when selected document changes
    if (selectedDocument) {
      getSignedUrl(selectedDocument);
    } else {
      setSignedUrl(null);
    }
  }, [selectedDocument]);

  const getSignedUrl = async (filePath: string) => {
    try {
      setUrlError(null);
      console.log("Getting signed URL for:", filePath);
      
      // First check if bucket exists
      const { data: buckets, error: bucketsError } = await supabase
        .storage
        .listBuckets();
        
      if (bucketsError) {
        console.error("Error listing buckets:", bucketsError);
        setUrlError("Error checking storage buckets.");
        return;
      }
      
      const policyBucket = buckets.find(bucket => bucket.id === 'policy-documents');
      if (!policyBucket) {
        console.error("Policy documents bucket doesn't exist");
        setUrlError("Storage bucket for policy documents doesn't exist.");
        return;
      }
      
      console.log("Found policy-documents bucket:", policyBucket.id);
      
      // Get signed URL
      const { data, error } = await supabase
        .storage
        .from('policy-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiration
      
      if (error) {
        console.error("Error getting signed URL:", error);
        setUrlError("Failed to load document. The file may not exist or you do not have permission to view it.");
        setSignedUrl(null);
        return;
      }
      
      console.log("Signed URL created:", data.signedUrl);
      setSignedUrl(data.signedUrl);
    } catch (error) {
      console.error("Exception getting signed URL:", error);
      setUrlError("An unexpected error occurred while loading the document.");
      setSignedUrl(null);
    }
  };

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
      } else {
        setSelectedDocument(null);
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

  const handleRetryLoad = () => {
    if (selectedDocument) {
      getSignedUrl(selectedDocument);
    }
  };

  const handleFileChange = () => {
    // Refresh the document data
    setLoadAttempt(prev => prev + 1);
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
              {isAdmin && (
                <div className="mt-4">
                  <p className="text-sm text-green-600 bg-green-50 p-2 rounded inline-block">
                    Admin Mode: You have full access to manage documents
                  </p>
                </div>
              )}
            </section>
            
            {/* File Upload Manager (only visible to admins) */}
            {isAdmin && (
              <FileUploadManager 
                categoryId={id || ''} 
                onFileChange={handleFileChange}
              />
            )}
            
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
                {selectedDocument && signedUrl ? (
                  <iframe
                    src={signedUrl}
                    className="w-full h-[70vh] rounded-lg"
                    title="PDF Viewer"
                    onError={() => setUrlError("Failed to load the PDF document")}
                  />
                ) : selectedDocument && !signedUrl ? (
                  <div className="text-center p-8">
                    {urlError ? (
                      <>
                        <Alert variant="destructive" className="mb-4">
                          <AlertDescription>
                            {urlError}
                          </AlertDescription>
                        </Alert>
                        <div className="mt-4 space-y-4">
                          <Button 
                            onClick={handleRetryLoad}
                            variant="outline"
                          >
                            Retry Loading Document
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-12 w-12 text-gray-400 mx-auto mb-3 animate-spin" />
                        <p className="text-gray-500">Loading document...</p>
                      </>
                    )}
                  </div>
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
