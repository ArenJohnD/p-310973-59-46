-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    file_path TEXT,
    file_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true
);

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS documents_content_idx ON public.documents USING gin (to_tsvector('english', content));

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Documents are viewable by everyone" 
    ON public.documents FOR SELECT 
    USING (true);

CREATE POLICY "Documents are insertable by authenticated users" 
    ON public.documents FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Documents are updatable by creator" 
    ON public.documents FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = created_by);

CREATE POLICY "Documents are deletable by creator" 
    ON public.documents FOR DELETE 
    TO authenticated 
    USING (auth.uid() = created_by);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 