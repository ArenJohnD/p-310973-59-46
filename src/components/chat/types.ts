
import { Message, ReferenceDocument, ChatSession } from "@/types/chat";

export interface ChatBotProps {
  isMaximized?: boolean;
}

export interface ChatContextType {
  messages: Message[];
  isLoading: boolean;
  sendMessage: (message: string) => Promise<void>;
  showTypingMessage: boolean;
  referenceDocuments: ReferenceDocument[];
  currentSessionId: string | null;
}

export interface ChatSessionsContextType {
  chatSessions: ChatSession[];
  filteredChatSessions: ChatSession[];
  currentSessionId: string | null;
  loadingHistory: boolean;
  creatingNewSession: boolean;
  pendingSession: string | null;
  handleSessionLoaded: (sessionId: string) => Promise<void>;
  handleCreateNewSession: () => Promise<void>;
  handleLastSessionDeleted: () => void;
}
