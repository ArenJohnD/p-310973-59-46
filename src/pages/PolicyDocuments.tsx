
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { Loader2, AlertCircle } from "lucide-react";

interface PolicyDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface PolicyCategory {
  id: string;
  title: string;
}

const PolicyDocuments = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, refreshAdminStatus } = useAuth();
  const [policyDoc, setPolicyDoc] = useState<PolicyDocument | null>(null);
  const [category, setCategory] = useState<PolicyCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // When component mounts, refresh admin status
    refreshAdminStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchPolicyDoc = async () => {
      try {
        setLoading(true);
        
        // Fetch the category information
        const { data: categoryData, error: categoryError } = await supabase
          .from('policy_categories')
          .select('*')
          .eq('id', id)
          .single();
          
        if (categoryError) throw categoryError;
        setCategory(categoryData);
        
        // Fetch any associated document for this category
        const { data: documentsData, error: documentsError } = await supabase
          .from('policy_documents')
          .select('*')
          .eq('category_id', id)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (documentsError) throw documentsError;
        
        if (documentsData && documentsData.length > 0) {
          setPolicyDoc(documentsData[0]);
          
          // Get signed URL for the PDF
          setUrlLoading(true);
          getSignedUrl(documentsData[0].file_path);
        }
      } catch (error) {
        console.error("Error fetching policy document:", error);
        toast({
          title: "Error",
          description: "Failed to load policy document",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchPolicyDoc();
  }, [id, retryCount]);

  const getSignedUrl = async (filePath: string) => {
    try {
      console.log("Getting signed URL for:", filePath);
      setLoadError(null);
      
      // First check if bucket exists
      const { data: buckets, error: bucketsError } = await supabase
        .storage
        .listBuckets();
        
      if (bucketsError) {
        console.error("Error listing buckets:", bucketsError);
        setLoadError("Error checking storage buckets.");
        setUrlLoading(false);
        return;
      }
      
      const policyBucket = buckets.find(bucket => bucket.id === 'policy-documents');
      if (!policyBucket) {
        console.error("Policy documents bucket doesn't exist");
        setLoadError("Storage bucket for policy documents doesn't exist.");
        setUrlLoading(false);
        return;
      }
      
      console.log("Found policy-documents bucket:", policyBucket.id);
      
      const { data, error } = await supabase
        .storage
        .from('policy-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiration
      
      if (error) {
        console.error("Error getting signed URL:", error);
        setLoadError("Failed to load document. The file may not exist or you do not have permission to view it.");
        setPdfUrl(null);
        setUrlLoading(false);
        return;
      }
      
      console.log("Signed URL created:", data.signedUrl);
      setPdfUrl(data.signedUrl);
      setUrlLoading(false);
    } catch (error) {
      console.error("Exception getting signed URL:", error);
      setLoadError("An unexpected error occurred loading the document.");
      setPdfUrl(null);
      setUrlLoading(false);
    }
  };

  const handleRetry = () => {
    setUrlLoading(true);
    setRetryCount(prev => prev + 1);
  };

  const handleViewInFullScreen = () => {
    if (id) {
      navigate(`/policy-viewer/${id}`);
    }
  };

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
            {category?.title || "Policy Document"}
          </h1>
          <p className="text-black text-xl mt-2">
            {policyDoc ? "View the policy document below" : "No document available for this policy category"}
          </p>
          {isAdmin && (
            <div className="mt-4">
              <p className="text-sm text-green-600 bg-green-50 p-2 rounded inline-block">
                Admin Mode: You have full access to manage documents
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
          
          {policyDoc && (
            <Button
              onClick={handleViewInFullScreen}
              className="bg-blue-600 hover:bg-blue-700"
            >
              View Full Screen
            </Button>
          )}
          
          {isAdmin && (
            <Button 
              onClick={() => navigate('/admin')}
              className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)]"
            >
              Manage in Admin
            </Button>
          )}
        </div>

        {policyDoc ? (
          <div className="flex flex-col items-center">
            <div className="mb-6 text-center">
              <h2 className="text-xl font-semibold mb-2">{policyDoc.file_name}</h2>
              <p className="text-gray-500">
                Uploaded on {new Date(policyDoc.created_at).toLocaleDateString()}
              </p>
            </div>
            
            {urlLoading ? (
              <div className="flex flex-col items-center justify-center h-[500px] w-full max-w-4xl border border-gray-300 rounded-lg">
                <Loader2 className="h-10 w-10 animate-spin text-gray-500 mb-4" />
                <p className="text-gray-600">Loading document...</p>
              </div>
            ) : pdfUrl ? (
              <div className="w-full max-w-4xl border border-gray-300 rounded-lg overflow-hidden shadow-lg">
                <iframe
                  src={pdfUrl}
                  className="w-full h-[800px]"
                  title={policyDoc.file_name}
                />
              </div>
            ) : (
              <div className="text-center p-10 border border-gray-200 rounded-lg w-full max-w-4xl">
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <AlertDescription>
                    {loadError || "Failed to load policy document. The document could not be loaded."}
                  </AlertDescription>
                </Alert>
                
                <Button onClick={handleRetry} variant="outline" className="mb-4">
                  Retry Loading Document
                </Button>
                
                {isAdmin && (
                  <p className="text-sm text-gray-600 mt-4 bg-yellow-50 p-3 rounded border border-yellow-200">
                    As an admin, you can check the document or upload a new one from the Admin Dashboard.
                    Make sure the file exists in the policy-documents storage bucket.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-10 border border-gray-200 rounded-lg">
            <p className="text-gray-600 mb-2">No document has been uploaded for this policy category yet.</p>
            {isAdmin && (
              <p className="text-sm text-gray-500">
                You can upload a document from the Admin Dashboard.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default PolicyDocuments;
