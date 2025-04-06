
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, FileText } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ReferenceDocument {
  id: string;
  file_name: string;
  file_path: string;
  created_at: string;
}

export function ReferenceDocumentManager() {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<ReferenceDocument[]>([]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('reference_documents')
        .select('id, file_name, file_path, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        setDocuments(data);
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Could not fetch reference documents",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      // Check if file is a PDF
      if (file.type !== "application/pdf") {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF file only",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);

      // 1. Upload file to storage
      const fileName = `reference-${Date.now()}-${selectedFile.name}`;
      const filePath = `reference_documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('policy_documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // 2. Insert record in database
      const { error: dbError } = await supabase
        .from('reference_documents')
        .insert({
          file_name: selectedFile.name,
          file_path: filePath,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id || '',
        });

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Reference document uploaded successfully",
      });

      // Reset state
      setSelectedFile(null);
      
      // Refresh document list
      fetchDocuments();

    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Upload failed",
        description: "Could not upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      setIsDeleting(true);

      // 1. Get the file path from database
      const { data, error: fetchError } = await supabase
        .from('reference_documents')
        .select('file_path')
        .eq('id', documentId)
        .single();

      if (fetchError) throw fetchError;

      // 2. Delete file from storage
      if (data && data.file_path) {
        const { error: storageError } = await supabase.storage
          .from('policy_documents')
          .remove([data.file_path]);

        if (storageError) throw storageError;
      }

      // 3. Delete record from database
      const { error: dbError } = await supabase
        .from('reference_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Document deleted successfully",
      });

      // Refresh document list
      fetchDocuments();

    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Delete failed",
        description: "Could not delete document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="border rounded-md p-4 bg-gray-50">
      <h3 className="text-lg font-medium mb-4">AI Reference Documents</h3>
      <p className="text-sm text-gray-500 mb-4">
        Upload PDF documents that will be used as reference by the AI chatbot to answer user questions.
      </p>
      
      <div className="space-y-4">
        {/* File input section */}
        <div className="bg-white border rounded-md p-4">
          <h4 className="font-medium mb-2">Upload New Reference Document</h4>
          <div className="flex flex-col gap-3">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="border rounded-md p-2"
            />
            <div className="flex gap-2">
              <Button 
                onClick={uploadFile} 
                disabled={!selectedFile || isUploading}
                className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)]"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </>
                )}
              </Button>
              {selectedFile && (
                <p className="text-sm text-gray-500 my-auto">
                  Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Documents list section */}
        <div className="bg-white border rounded-md p-4">
          <h4 className="font-medium mb-2">Existing Reference Documents</h4>
          
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex justify-between items-center p-3 bg-gray-50 border rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-600" />
                    <div className="truncate">
                      <p className="font-medium truncate max-w-md">{doc.file_name}</p>
                      <p className="text-xs text-gray-500">
                        Uploaded: {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isDeleting}>
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-1" />
                          )}
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Document</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{doc.file_name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteDocument(doc.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 py-4 text-center">No reference documents uploaded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
