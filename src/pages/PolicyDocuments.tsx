
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";

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
  const { isAdmin } = useAuth();
  const [policyDoc, setPolicyDoc] = useState<PolicyDocument | null>(null);
  const [category, setCategory] = useState<PolicyCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

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
          const { data: urlData, error: urlError } = await supabase
            .storage
            .from('policy-documents')
            .createSignedUrl(documentsData[0].file_path, 3600);
            
          if (urlError) throw urlError;
          setPdfUrl(urlData.signedUrl);
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
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[rgba(233,233,233,1)]">
        <Header />
        <main className="bg-white flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
          <div className="flex justify-center items-center h-64">
            <p className="text-xl">Loading...</p>
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
        </section>
        
        <div className="flex justify-center mb-8">
          <Button 
            onClick={() => navigate('/')}
            className="bg-gray-500 hover:bg-gray-600 mr-4"
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

        {policyDoc ? (
          <div className="flex flex-col items-center">
            <div className="mb-6 text-center">
              <h2 className="text-xl font-semibold mb-2">{policyDoc.file_name}</h2>
              <p className="text-gray-500">
                Uploaded on {new Date(policyDoc.created_at).toLocaleDateString()}
              </p>
            </div>
            
            {pdfUrl && (
              <div className="w-full max-w-4xl border border-gray-300 rounded-lg overflow-hidden shadow-lg">
                <iframe
                  src={pdfUrl}
                  className="w-full h-[800px]"
                  title={policyDoc.file_name}
                />
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
