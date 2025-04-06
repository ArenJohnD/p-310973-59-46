
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const { isAdmin } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  if (!isAdmin) {
    return null; // Don't render anything for non-admin users
  }

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
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${categoryId}-${Date.now()}.${fileExt}`;
      const filePath = `${categoryId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('policy_documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // 2. Insert record in database
      const { error: dbError } = await supabase
        .from('policy_documents')
        .insert({
          category_id: categoryId,
          file_name: selectedFile.name,
          file_path: filePath,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id || '',
        });

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });

      // Close dialog and reset state
      setUploadDialogOpen(false);
      setSelectedFile(null);
      
      // Notify parent component
      if (onFileChange) {
        onFileChange();
      }

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

  const deleteDocument = async () => {
    if (!existingDocument) return;

    try {
      setIsDeleting(true);

      // 1. Get the file path from database
      const { data: docData, error: fetchError } = await supabase
        .from('policy_documents')
        .select('file_path')
        .eq('id', existingDocument.id)
        .single();

      if (fetchError) throw fetchError;

      // 2. Delete file from storage
      if (docData?.file_path) {
        const { error: storageError } = await supabase.storage
          .from('policy_documents')
          .remove([docData.file_path]);

        if (storageError) throw storageError;
      }

      // 3. Delete record from database
      const { error: dbError } = await supabase
        .from('policy_documents')
        .delete()
        .eq('id', existingDocument.id);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Document deleted successfully",
      });

      // Notify parent component
      if (onFileChange) {
        onFileChange();
      }

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
    <div className="border rounded-md p-4 bg-gray-50 mb-6">
      <h3 className="text-lg font-medium mb-4">Document Management</h3>
      {existingDocument ? (
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between p-3 bg-white border rounded-md">
            <div className="flex-1 truncate">
              <p className="font-medium">{existingDocument.file_name}</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isDeleting}>
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the document. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteDocument}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className="text-sm text-gray-500">
            To replace this document, please delete it first and then upload a new one.
          </p>
        </div>
      ) : (
        <div>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)]">
                <Upload className="h-4 w-4 mr-2" />
                Upload PDF Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Policy Document</DialogTitle>
                <DialogDescription>
                  Upload a PDF document for this policy category. 
                  Only PDF files are accepted.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="file-upload" className="text-sm font-medium">
                    Select PDF file
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="border rounded-md p-2"
                  />
                  {selectedFile && (
                    <p className="text-sm text-gray-500">
                      Selected file: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                    </p>
                  )}
                </div>
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
                    "Upload Document"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <p className="text-sm text-gray-500 mt-2">
            No document uploaded for this category yet. Click the button above to upload a PDF document.
          </p>
        </div>
      )}
    </div>
  );
}
