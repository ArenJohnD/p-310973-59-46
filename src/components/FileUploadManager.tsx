
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  if (!isAdmin) {
    return null; // Don't render anything for non-admin users
  }

  return (
    <div className="border rounded-md p-4 bg-gray-50 mb-6">
      <h3 className="text-lg font-medium mb-4">Document Management</h3>
      <p className="text-gray-600">File handling functionality has been removed from the application.</p>
    </div>
  );
}
