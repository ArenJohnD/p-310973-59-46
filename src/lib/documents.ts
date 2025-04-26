import { supabase } from '@/integrations/supabase/client';
import { Document, DocumentUpload } from '../types/documents';

export const documentService = {
    async verifyStorageBucket() {
        try {
            console.log('Starting storage bucket verification...');
            
            // Check if bucket exists
            const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
            if (bucketsError) {
                console.error('Error checking buckets:', {
                    error: bucketsError,
                    message: bucketsError.message
                });
                throw bucketsError;
            }

            console.log('Available buckets:', buckets.map(b => b.name));

            const bucket = buckets.find(b => b.name === 'reference_documents');
            if (!bucket) {
                console.error('Reference documents bucket not found. Available buckets:', 
                    buckets.map(b => b.name));
                return false;
            }

            // Try to list files to verify permissions
            console.log('Checking bucket permissions...');
            const { data: files, error: filesError } = await supabase.storage
                .from('reference_documents')
                .list();
            
            if (filesError) {
                console.error('Error listing files:', {
                    error: filesError,
                    message: filesError.message
                });
                return false;
            }

            // Check if user is authenticated
            const { data: user, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error('Auth error:', {
                    error: userError,
                    message: userError.message
                });
                return false;
            }

            if (!user) {
                console.error('No authenticated user found');
                return false;
            }

            console.log('Storage bucket verification successful:', {
                bucket: bucket.name,
                id: bucket.id,
                public: bucket.public,
                filesCount: files.length,
                authenticated: !!user,
                userId: user.user?.id
            });

            return true;
        } catch (error) {
            console.error('Storage bucket verification failed:', error);
            return false;
        }
    },

    async uploadDocument(document: DocumentUpload): Promise<Document> {
        try {
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error('Auth error:', userError);
                throw userError;
            }

            let filePath = null;
            if (document.file) {
                const fileExt = document.file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                
                // First, check if the bucket exists
                const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
                if (bucketsError) {
                    console.error('Error checking buckets:', bucketsError);
                    throw bucketsError;
                }

                const documentsBucketExists = buckets.some(bucket => bucket.name === 'reference_documents');
                if (!documentsBucketExists) {
                    console.error('Reference documents bucket does not exist');
                    throw new Error('Storage bucket "reference_documents" does not exist');
                }

                // Attempt file upload
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('reference_documents')
                    .upload(fileName, document.file);

                if (uploadError) {
                    console.error('File upload error:', uploadError);
                    throw uploadError;
                }
                
                filePath = uploadData.path;
            }

            // Insert document record
            const { data, error } = await supabase
                .from('reference_documents')
                .insert({
                    file_name: document.title,
                    file_path: filePath,
                    file_size: document.file?.size || 0,
                    mime_type: document.file?.type || 'text/plain',
                    uploaded_by: userData.user.id,
                    processed: false,
                    is_blocked: false
                })
                .select()
                .single();

            if (error) {
                console.error('Database insert error:', error);
                throw error;
            }

            return {
                id: data.id,
                title: data.file_name,
                content: '',  // Content will be processed later
                file_path: data.file_path,
                file_type: data.mime_type,
                created_at: data.created_at,
                updated_at: data.updated_at,
                created_by: data.uploaded_by,
                is_active: !data.is_blocked
            };
        } catch (error) {
            console.error('Document upload failed:', error);
            throw error;
        }
    },

    async getDocuments(): Promise<Document[]> {
        const { data, error } = await supabase
            .from('reference_documents')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        return data.map(doc => ({
            id: doc.id,
            title: doc.file_name,
            content: '',  // Content is stored elsewhere
            file_path: doc.file_path,
            file_type: doc.mime_type,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
            created_by: doc.uploaded_by,
            is_active: !doc.is_blocked
        }));
    },

    async deleteDocument(id: string): Promise<void> {
        const { error } = await supabase
            .from('reference_documents')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async searchDocuments(query: string): Promise<Document[]> {
        // Note: This might need to be updated based on how document content is actually stored and searched
        const { data, error } = await supabase
            .from('reference_documents')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        return data.map(doc => ({
            id: doc.id,
            title: doc.file_name,
            content: '',  // Content is stored elsewhere
            file_path: doc.file_path,
            file_type: doc.mime_type,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
            created_by: doc.uploaded_by,
            is_active: !doc.is_blocked
        }));
    }
}; 