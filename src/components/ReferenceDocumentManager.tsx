import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, FileText, Upload as UploadIcon } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

interface ReferenceDocument {
  id: string;
  file_name: string;
  file_path: string;
  created_at: string;
}

interface ReferenceDocumentManagerProps {
  onDocumentChange?: () => void;
}

export function ReferenceDocumentManager({ onDocumentChange }: ReferenceDocumentManagerProps) {
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

      const fileName = `reference-${Date.now()}-${selectedFile.name}`;
      const filePath = `reference_documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('policy_documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

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

      setSelectedFile(null);
      
      fetchDocuments();
      if (onDocumentChange) onDocumentChange();
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

      const { data, error: fetchError } = await supabase
        .from('reference_documents')
        .select('file_path')
        .eq('id', documentId)
        .single();

      if (fetchError) throw fetchError;

      if (data && data.file_path) {
        const { error: storageError } = await supabase.storage
          .from('policy_documents')
          .remove([data.file_path]);

        if (storageError) throw storageError;
      }

      const { error: dbError } = await supabase
        .from('reference_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Document deleted successfully",
      });

      fetchDocuments();
      if (onDocumentChange) onDocumentChange();
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
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Upload Reference Document</h3>
            <p className="text-sm text-gray-500 mt-1">
              Upload PDF documents that will be used as reference by the AI chatbot.
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            PDF Only
          </Badge>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label 
                htmlFor="file-upload" 
                className="relative flex flex-col items-center justify-center w-full h-[140px] cursor-pointer rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-[rgba(49,159,67,0.5)] transition-all group"
              >
                <input
                  id="file-upload"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadIcon className="h-8 w-8 text-gray-400 group-hover:text-[rgba(49,159,67,1)] mb-2" />
                  <p className="text-sm text-gray-500">
                    {selectedFile ? (
                      <span className="font-medium text-[rgba(49,159,67,1)]">{selectedFile.name}</span>
                    ) : (
                      <>
                        <span className="font-semibold text-[rgba(49,159,67,1)]">Click to upload</span>{" "}
                        <span className="text-gray-500">or drag and drop</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PDF files only</p>
                </div>
              </label>
            </div>
            <Button
              onClick={uploadFile}
              disabled={!selectedFile || isUploading}
              className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)] text-white shadow-sm min-w-[120px]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Reference Documents</h3>
              <p className="text-sm text-gray-500 mt-1">
                Manage your uploaded reference documents
              </p>
            </div>
            <Badge variant="secondary">
              {documents.length} {documents.length === 1 ? 'document' : 'documents'}
            </Badge>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-[rgba(49,159,67,1)]" />
              <span className="ml-3 text-gray-600">Loading documents...</span>
            </div>
          ) : documents.length > 0 ? (
            documents.map((doc) => (
              <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[rgba(49,159,67,0.1)] rounded-lg">
                    <FileText className="h-5 w-5 text-[rgba(49,159,67,1)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                    <p className="text-xs text-gray-500">
                      Uploaded {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Document</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this reference document? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteDocument(doc.id)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <div className="flex flex-col items-center justify-center text-gray-500">
                <FileText className="h-8 w-8 mb-2 text-gray-400" />
                <p className="text-sm font-medium">No documents uploaded</p>
                <p className="text-sm text-gray-400 mt-1">Upload a document to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
