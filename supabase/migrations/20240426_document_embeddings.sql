
-- Create document_embeddings table for storing vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.reference_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create an index for similarity search
CREATE INDEX ON document_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Enable RLS
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all users to select document_embeddings"
  ON public.document_embeddings
  FOR SELECT
  USING (true);

CREATE POLICY "Allow admins to insert document_embeddings"
  ON public.document_embeddings
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Allow admins to update document_embeddings"
  ON public.document_embeddings
  FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Allow admins to delete document_embeddings"
  ON public.document_embeddings
  FOR DELETE
  USING (public.is_admin());
