
-- Create table for AI reference documents
CREATE TABLE IF NOT EXISTS public.reference_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.reference_documents ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage reference documents
CREATE POLICY "Admins can manage reference documents" 
  ON public.reference_documents 
  USING (public.is_admin());

-- Create policy for all users to view reference documents
CREATE POLICY "All users can view reference documents" 
  ON public.reference_documents 
  FOR SELECT 
  TO PUBLIC
  USING (true);
