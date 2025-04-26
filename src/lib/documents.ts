import { supabase } from './supabase';
import { Document, DocumentUpload } from '../types/documents';

export const documentService = {
    async uploadDocument(document: DocumentUpload): Promise<Document> {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        let filePath = null;
        if (document.file) {
            const fileExt = document.file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(fileName, document.file);

            if (uploadError) throw uploadError;
            filePath = uploadData.path;
        }

        const { data, error } = await supabase
            .from('documents')
            .insert({
                title: document.title,
                content: document.content,
                file_path: filePath,
                file_type: document.file?.type,
                created_by: userData.user.id,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async getDocuments(): Promise<Document[]> {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async deleteDocument(id: string): Promise<void> {
        const { error } = await supabase
            .from('documents')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async searchDocuments(query: string): Promise<Document[]> {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .textSearch('content', query)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }
}; 