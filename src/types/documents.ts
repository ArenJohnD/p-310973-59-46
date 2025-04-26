export interface Document {
    id: string;
    title: string;
    content: string;
    file_path?: string;
    file_type?: string;
    created_at: string;
    updated_at: string;
    created_by: string;
    is_active: boolean;
}

export interface DocumentUpload {
    title: string;
    content: string;
    file?: File;
} 