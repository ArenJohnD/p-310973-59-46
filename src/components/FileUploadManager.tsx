
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, Upload, FileText, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FileUploadManagerProps {
  categoryId: string;
  onFileChange?: () => void;
  existingDocument?: {
    id: string;
    file_name: string;
  } | null;
}

export function FileUploadManager({ 
  categoryId, 
  onFileChange,
  existingDocument 
}: FileUploadManagerProps) {
  const { isAdmin, user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (selectedFile) {
      // Validate if it's a PDF
      if (selectedFile.type !== 'application/pdf') {
        setError('Only PDF files are allowed');
        setFile(null);
        return;
      }
      
      // Check file size (limit to 5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('File size exceeds 5MB limit');
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      setError(null);
    }
  };

  const uploadFile = async () => {
    if (!file || !isAdmin || !user) return;
    
    setUploading(true);
    setError(null);
    
    try {
      // Generate a unique file path
      const fileExt = file.name.split('.').pop();
      const filePath = `${categoryId}/${Date.now()}.${fileExt}`;
      
      // Check if storage bucket exists
      const { data: buckets, error: bucketsError } = await supabase
        .storage
        .listBuckets();
      
      if (bucketsError) {
        throw new Error(`Error checking storage buckets: ${bucketsError.message}`);
      }
      
      const policyBucket = buckets.find(bucket => bucket.id === 'policy-documents');
      if (!policyBucket) {
        throw new Error("Storage bucket for policy documents doesn't exist");
      }
      
      // Upload the file to storage
      const { error: uploadError } = await supabase
        .storage
        .from('policy-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) {
        throw new Error(`Error uploading file: ${uploadError.message}`);
      }
      
      // Create an entry in the policy_documents table
      const { error: dbError } = await supabase
        .from('policy_documents')
        .insert({
          category_id: categoryId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user.id
        });
      
      if (dbError) {
        throw new Error(`Error updating database: ${dbError.message}`);
      }
      
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
      
      // Clear the file input
      setFile(null);
      
      // Inform parent component that a file change occurred
      if (onFileChange) {
        onFileChange();
      }
      
    } catch (error) {
      console.error("File upload error:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
      
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async () => {
    if (!existingDocument || !isAdmin) return;
    
    setDeleting(true);
    setError(null);
    
    try {
      // First get the file path
      const { data: documentData, error: docError } = await supabase
        .from('policy_documents')
        .select('file_path')
        .eq('id', existingDocument.id)
        .single();
      
      if (docError) {
        throw new Error(`Error getting document: ${docError.message}`);
      }
      
      // Delete from storage
      if (documentData.file_path) {
        const { error: storageError } = await supabase
          .storage
          .from('policy-documents')
          .remove([documentData.file_path]);
        
        if (storageError) {
          throw new Error(`Error removing from storage: ${storageError.message}`);
        }
      }
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('policy_documents')
        .delete()
        .eq('id', existingDocument.id);
      
      if (dbError) {
        throw new Error(`Error removing from database: ${dbError.message}`);
      }
      
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
      
      // Inform parent component that a file change occurred
      if (onFileChange) {
        onFileChange();
      }
      
    } catch (error) {
      console.error("Delete error:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
      
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Failed to delete document",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (!isAdmin) {
    return null; // Don't render anything for non-admin users
  }

  return (
    <div className="border rounded-md p-4 bg-gray-50 mb-6">
      <h3 className="text-lg font-medium mb-4">Document Management</h3>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4 mr-2" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {existingDocument ? (
        <div className="mb-4 p-3 border rounded bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FileText className="h-5 w-5 text-blue-500 mr-2" />
              <span>{existingDocument.file_name}</span>
            </div>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={deleteDocument}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="flex-1"
              disabled={uploading}
            />
            <Button
              onClick={uploadFile}
              disabled={!file || uploading}
              className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)]"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload PDF
                </>
              )}
            </Button>
          </div>
          
          {file && (
            <div className="p-2 bg-white border rounded flex items-center">
              <FileText className="h-4 w-4 text-blue-500 mr-2" />
              <span className="text-sm">{file.name}</span>
            </div>
          )}
          
          <div className="text-xs text-gray-500">
            <p>• Only PDF files are supported</p>
            <p>• Maximum file size: 5MB</p>
          </div>
        </div>
      )}
    </div>
  );
}
