
import { supabase } from "@/integrations/supabase/client";
import { ChatSession, DocumentSection, Message, ReferenceDocument } from "@/types/chat";
import { extractDocumentSections, extractTextFromPDF } from "@/utils/pdfUtils";
import { findBestMatch } from "@/utils/searchUtils";

export const fetchChatSessions = async (userId: string): Promise<ChatSession[]> => {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  return data as ChatSession[];
};

export const loadChatMessages = async (sessionId: string): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });
    
  if (error) throw error;
  
  if (data) {
    return data.map(msg => ({
      id: msg.id,
      text: msg.text,
      sender: msg.sender as "user" | "bot",
      timestamp: new Date(msg.timestamp)
    }));
  }
  
  return [];
};

export const createNewSession = async (userId: string): Promise<ChatSession | null> => {
  // First, deactivate all existing sessions
  await supabase
    .from('chat_sessions')
    .update({ is_active: false })
    .eq('user_id', userId);
  
  // Create a new session
  const { data: sessionData, error: sessionError } = await supabase
    .from('chat_sessions')
    .insert([{
      user_id: userId,
      title: 'New Chat',
      is_active: true
    }])
    .select();
    
  if (sessionError) throw sessionError;
  
  if (sessionData && sessionData.length > 0) {
    // Add welcome message
    await supabase
      .from('chat_messages')
      .insert([{
        session_id: sessionData[0].id,
        text: "Hi! I'm Poli, your NEU policy assistant. I can help you find information about university policies, answer questions about academic regulations, and guide you through administrative procedures. How can I assist you today?",
        sender: "bot"
      }]);
    
    return sessionData[0] as ChatSession;
  }
  
  return null;
};

export const setSessionActive = async (userId: string, sessionId: string): Promise<void> => {
  await supabase
    .from('chat_sessions')
    .update({ is_active: false })
    .eq('user_id', userId);
    
  await supabase
    .from('chat_sessions')
    .update({ is_active: true })
    .eq('id', sessionId);
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  await supabase
    .from('chat_messages')
    .delete()
    .eq('session_id', sessionId);
    
  await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId);
};

export const updateSessionTitle = async (sessionId: string, title: string): Promise<void> => {
  await supabase
    .from('chat_sessions')
    .update({ title })
    .eq('id', sessionId);
};

export const generateChatTitle = async (userMessage: string, botResponse: string = ""): Promise<string> => {
  try {
    let topic = '';
    
    const botFirstSentence = botResponse.split('.')[0].trim();
    if (botFirstSentence.length > 5 && botFirstSentence.length < 50) {
      if (botFirstSentence.includes('policy') || botFirstSentence.includes('regulation') || 
          botFirstSentence.includes('procedure') || botFirstSentence.includes('guideline')) {
        topic = botFirstSentence;
      }
    }
    
    if (!topic) {
      const questionMatch = userMessage.match(/(?:what|how|where|when|who|can|is|are|do|does).+?(\w+(?:\s+\w+){0,5})\??$/i);
      if (questionMatch && questionMatch[1]) {
        topic = `About ${questionMatch[1].trim()}`;
      } else {
        const words = userMessage.split(/\s+/);
        const keyWords = words.filter(word => word.length > 3).slice(0, 3);
        
        if (keyWords.length > 0) {
          const firstWord = keyWords[0].charAt(0).toUpperCase() + keyWords[0].slice(1);
          topic = `${firstWord} ${keyWords.slice(1).join(' ')}`;
        } else {
          topic = "New Conversation";
        }
      }
    }
    
    if (topic.length > 30) {
      topic = topic.substring(0, 30) + '...';
    }
    
    return topic;
  } catch (error) {
    console.error("Error generating title:", error);
    return "New Conversation";
  }
};

export const fetchReferenceDocuments = async (): Promise<ReferenceDocument[]> => {
  const { data, error } = await supabase
    .from('reference_documents')
    .select('id, file_name, file_path')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return data || [];
};

export const saveMessage = async (sessionId: string, text: string, sender: "user" | "bot"): Promise<void> => {
  await supabase
    .from('chat_messages')
    .insert([{
      session_id: sessionId,
      text,
      sender
    }]);
};

export const findRelevantInformation = async (query: string, referenceDocuments: ReferenceDocument[]): Promise<string> => {
  if (referenceDocuments.length === 0) {
    try {
      console.log("No reference documents found, using Mistral API directly");
      const { data, error } = await supabase.functions.invoke('mistral-chat', {
        body: { query, context: "" }
      });

      if (error) throw new Error(error.message);
      
      return data.answer;
    } catch (err) {
      console.error("Error calling Mistral API:", err);
      return "I'm sorry, I encountered an error while processing your question. Please try again later.";
    }
  }

  try {
    const allSections: DocumentSection[] = [];
    
    for (const doc of referenceDocuments) {
      if (!doc.text_content) {
        console.log(`Processing document: ${doc.file_name}`);
        try {
          const { data: fileData } = await supabase.storage
            .from('policy_documents')
            .createSignedUrl(doc.file_path, 3600);
            
          if (fileData?.signedUrl) {
            const text = await extractTextFromPDF(fileData.signedUrl);
            
            const sections = extractDocumentSections(text);
            allSections.push(...sections);
            console.log(`Extracted ${sections.length} sections from ${doc.file_name}`);
          }
        } catch (err) {
          console.error(`Error extracting text from ${doc.file_name}:`, err);
        }
      } else {
        const sections = extractDocumentSections(doc.text_content);
        allSections.push(...sections);
        console.log(`Using ${sections.length} sections from cached document ${doc.file_name}`);
      }
    }
    
    console.log(`Total sections available: ${allSections.length}`);
    
    const bestMatches = findBestMatch(query, allSections);
    
    if (bestMatches.length > 0) {
      console.log(`Found ${bestMatches.length} relevant sections`);
      
      const context = bestMatches
        .map(match => `${match.title}\n${match.content}`)
        .join('\n\n');
      
      console.log("Context length: ", context.length);
      console.log("Sending query to Mistral with context");
      
      try {
        const { data, error } = await supabase.functions.invoke('mistral-chat', {
          body: { query, context }
        });

        if (error) throw new Error(error.message);
        
        return data.answer;
      } catch (err) {
        console.error("Error calling Mistral API with context:", err);
        
        return `Based on the policy documents, here's what I found:\n\n${bestMatches[0].content}`;
      }
    } else {
      console.log("No specific matches found. Using general context");
      
      const generalContext = allSections
        .slice(0, 5)
        .map(section => `${section.title}\n${section.content}`)
        .join('\n\n');
        
      try {
        const { data, error } = await supabase.functions.invoke('mistral-chat', {
          body: { query, context: generalContext }
        });

        if (error) throw new Error(error.message);
        
        return data.answer;
      } catch (err) {
        console.error("Error calling Mistral API with general context:", err);
        return "I couldn't find specific information about this in the policy documents. Please check the university handbook or ask an administrator.";
      }
    }
  } catch (error) {
    console.error("Error searching reference documents:", error);
    return "I encountered an error while searching the policy documents. Please try again later.";
  }
};
