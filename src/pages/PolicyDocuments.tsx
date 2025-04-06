
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import { 
  FileText, 
  Download, 
  Trash2, 
  ArrowLeft,
  Loader2
} from "lucide-react";

interface PolicyDocument {
  id: string;
  category_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface PolicyCategory {
  title: string;
}

const PolicyDocuments = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [category, setCategory] = useState<PolicyCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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
        .select('*')
        .eq('category_id', id)
        .order('created_at', { ascending: false });
      
      if (documentsError) throw documentsError;
      setDocuments(documentsData || []);
      
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    try {
      setUploading(true);
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (file.type !== 'application/pdf') {
          toast({
            title: "Invalid file type",
            description: "Only PDF files are allowed.",
            variant: "destructive",
          });
          continue;
        }
        
        // Upload file to storage
        const filePath = `${id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('policy_documents')
          .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        // Create database record
        const { error: insertError } = await supabase
          .from('policy_documents')
          .insert({
            category_id: id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: (await supabase.auth.getUser()).data.user?.id,
          });
        
        if (insertError) throw insertError;
      }
      
      // Refresh document list
      fetchCategoryAndDocuments();
      
      toast({
        title: "Success",
        description: "Document(s) uploaded successfully.",
      });
      
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({
        title: "Error",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset file input
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    }
  };

  const handleDeleteDocument = async (document: PolicyDocument) => {
    if (!confirm(`Are you sure you want to delete "${document.file_name}"?`)) {
      return;
    }
    
    try {
      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('policy_documents')
        .remove([document.file_path]);
      
      if (storageError) throw storageError;
      
      // Delete database record
      const { error: dbError } = await supabase
        .from('policy_documents')
        .delete()
        .eq('id', document.id);
      
      if (dbError) throw dbError;
      
      // Update local state
      setDocuments(documents.filter(doc => doc.id !== document.id));
      
      toast({
        title: "Success",
        description: "Document deleted successfully.",
      });
      
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: "Error",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadDocument = async (document: PolicyDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('policy_documents')
        .download(document.file_path);
      
      if (error) throw error;
      
      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Error",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    else return (bytes / (1024 * 1024)).toFixed(2) + " MB";
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
                View and download policy documents for this category
              </p>
            </section>
            
            {isAdmin && (
              <section className="mb-8 p-6 bg-gray-50 rounded-lg">
                <h2 className="text-lg font-semibold mb-4">Upload New Documents</h2>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    id="file-upload"
                    accept=".pdf"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-green-50 file:text-green-700
                      hover:file:bg-green-100"
                  />
                  {uploading && (
                    <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Only PDF files are accepted. Maximum file size: 10MB.
                </p>
              </section>
            )}
            
            <section>
              <h2 className="text-xl font-semibold mb-4">Available Documents</h2>
              {documents.length > 0 ? (
                <ul className="space-y-3">
                  {documents.map((document) => (
                    <li 
                      key={document.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center">
                        <FileText className="h-6 w-6 text-gray-500 mr-3" />
                        <div>
                          <p className="font-medium">{document.file_name}</p>
                          <p className="text-sm text-gray-500">
                            {formatFileSize(document.file_size)} • Added on {new Date(document.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadDocument(document)}
                        >
                          <Download className="h-4 w-4 mr-1" /> Download
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteDocument(document)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-10 border rounded-lg bg-gray-50">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No documents available for this category.</p>
                  {isAdmin && (
                    <p className="text-gray-400 text-sm mt-2">
                      Upload documents using the form above.
                    </p>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default PolicyDocuments;
