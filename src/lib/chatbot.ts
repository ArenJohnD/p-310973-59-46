import { documentService } from './documents';

export const chatbotService = {
    async getResponse(query: string): Promise<string> {
        try {
            // Search for relevant documents
            const relevantDocs = await documentService.searchDocuments(query);

            if (relevantDocs.length === 0) {
                return "I apologize, but I don't have any information about that in my knowledge base. Please ask a question related to the documents that have been uploaded.";
            }

            // Combine relevant document contents
            const context = relevantDocs
                .map(doc => `Document: ${doc.title}\n${doc.content}`)
                .join('\n\n');

            // Here you would typically call your AI service with the context and query
            // For now, we'll return a simple response
            return `Based on the available documents, here's what I found:\n\n${context}\n\nWould you like to know more about any specific aspect of this information?`;
        } catch (error) {
            console.error('Error getting chatbot response:', error);
            return "I apologize, but I'm having trouble accessing the knowledge base right now. Please try again later.";
        }
    }
}; 