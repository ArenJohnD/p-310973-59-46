
export interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  is_active: boolean;
  user_id?: string;
  updated_at?: string;
}

export interface ReferenceDocument {
  id: string;
  file_name: string;
  file_path: string;
  text_content?: string;
  processed?: boolean;
  created_at?: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by?: string;
}

export interface DocumentSection {
  title: string;
  content: string;
  pageNumber: number;
  articleNumber?: string;
  sectionId?: string;
  position?: {
    startPage: number;
    startOffset?: number;
    endPage?: number;
    endOffset?: number;
  };
  documentId?: string;
  fileName?: string;
}

export interface Citation {
  id: string;
  reference: string;
  documentId?: string;
  position?: {
    startPage: number;
    startOffset?: number;
    endPage?: number;
    endOffset?: number;
  };
  fileName?: string;
}
