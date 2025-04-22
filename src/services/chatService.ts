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
  
  const uniqueSessions = Array.from(
    new Map(data?.map(session => [session.id, session])).values()
  );
  
  return uniqueSessions as ChatSession[];
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

export const createNewSession = async (userId: string, forceNew: boolean = true): Promise<ChatSession | null> => {
  if (!forceNew) {
    const { data: existingEmptySessions, error: checkError } = await supabase
      .from('chat_sessions')
      .select('id, chat_messages:chat_messages(count)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);
      
    if (checkError) throw checkError;

    if (existingEmptySessions && existingEmptySessions.length > 0) {
      const session = existingEmptySessions[0];
      const messageCount = session.chat_messages[0]?.count || 0;
      
      if (messageCount <= 1) {
        const { data: sessionData } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('id', session.id)
          .single();
        
        if (sessionData) {
          return sessionData as ChatSession;
        }
      }
    }
    
    const { data: otherEmptySessions, error: otherCheckError } = await supabase
      .from('chat_sessions')
      .select('id, chat_messages:chat_messages(count)')
      .eq('user_id', userId)
      .eq('is_active', false)
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (!otherCheckError && otherEmptySessions && otherEmptySessions.length > 0) {
      const session = otherEmptySessions[0];
      const messageCount = session.chat_messages[0]?.count || 0;
      
      if (messageCount <= 1) {
        await setSessionActive(userId, session.id);
        
        const { data: sessionData } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('id', session.id)
          .single();
        
        if (sessionData) {
          return sessionData as ChatSession;
        }
      }
    }
  }
  
  await supabase
    .from('chat_sessions')
    .update({ is_active: false })
    .eq('user_id', userId);
  
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
  
  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId);
    
  if (error) {
    console.error("Error deleting session:", error);
    throw error;
  }
};

export const updateSessionTitle = async (sessionId: string, title: string): Promise<void> => {
  await supabase
    .from('chat_sessions')
    .update({ title })
    .eq('id', sessionId);
};

export const generateChatTitle = async (userMessage: string, botResponse: string = ""): Promise<string> => {
  try {
    const cleanedMessage = userMessage.replace(/[^\w\s]/gi, ' ').toLowerCase();
    const words = cleanedMessage.split(/\s+/).filter(word => word.length > 2);
    
    const fillerWords = ['the', 'and', 'that', 'for', 'what', 'how', 'when', 'where', 'why', 'who', 'which', 'about'];
    const filteredWords = words.filter(word => !fillerWords.includes(word));
    
    const keyWords = filteredWords.slice(0, 5);
    
    if (keyWords.length > 0) {
      const firstWord = keyWords[0].charAt(0).toUpperCase() + keyWords[0].slice(1);
      let title = firstWord;
      
      if (keyWords.length > 1) {
        const additionalWords = keyWords.slice(1, Math.min(5, keyWords.length));
        title += ' ' + additionalWords.join(' ');
      }
      
      if (title.length > 30) {
        title = title.substring(0, 27) + '...';
      }
      
      return title;
    }
    
    return "New Chat";
  } catch (error) {
    console.error("Error generating title:", error);
    return "New Chat";
  }
};

export const fetchReferenceDocuments = async (): Promise<ReferenceDocument[]> => {
  try {
    const { data, error } = await supabase
      .from('reference_documents')
      .select('id, file_name, file_path')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error("Error fetching reference documents:", error);
    return [];
  }
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
  console.log(`Finding relevant information for query: "${query}"`);
  console.log(`Reference documents available: ${referenceDocuments.length}`);
  
  if (referenceDocuments.length === 0) {
    try {
      console.log("No reference documents found, using DeepSeek API directly");
      const { data, error } = await supabase.functions.invoke('deepseek-chat', {
        body: { query, context: "" }
      });

      if (error) {
        console.error("Error invoking DeepSeek function:", error);
        throw new Error(error.message);
      }
      
      return data.answer;
    } catch (err) {
      console.error("Error calling DeepSeek API:", err);
      return "I'm sorry, I encountered an error while processing your question. Please try again later.";
    }
  }

  try {
    const allSections: DocumentSection[] = [];
    const documentInfo = {};
    
    const maxDocsToProcess = Math.min(referenceDocuments.length, 8);
    console.log(`Will process ${maxDocsToProcess} documents (limited to avoid timeouts)`);
    
    const docsToProcess = referenceDocuments.slice(0, maxDocsToProcess);
    
    for (const doc of docsToProcess) {
      try {
        console.log(`Processing document: ${doc.file_name}`);
        
        const { data: fileData } = await supabase.storage
          .from('policy_documents')
          .createSignedUrl(doc.file_path, 3600);
          
        if (!fileData?.signedUrl) {
          console.error(`Could not get signed URL for ${doc.file_path}`);
          continue;
        }
        
        const text = await extractTextFromPDF(fileData.signedUrl);
        console.log(`Extracted text length: ${text.length} characters from ${doc.file_name}`);
        
        if (text.length === 0) {
          console.error(`No text extracted from ${doc.file_name}`);
          continue;
        }
        
        const sections = extractDocumentSections(text, doc.id, doc.file_name);
        
        sections.forEach(section => {
          if (section.articleNumber) {
            documentInfo[`article ${section.articleNumber}`] = {
              documentId: doc.id,
              position: section.position,
              fileName: doc.file_name
            };
          }
          
          if (section.sectionId) {
            documentInfo[`section ${section.sectionId}`] = {
              documentId: doc.id,
              position: section.position,
              fileName: doc.file_name
            };
          }
        });
        
        allSections.push(...sections);
        console.log(`Extracted ${sections.length} sections from ${doc.file_name}`);
      } catch (err) {
        console.error(`Error processing document ${doc.file_name}:`, err);
      }
    }
    
    console.log(`Total sections available for search: ${allSections.length}`);
    
    if (allSections.length === 0) {
      return "I don't have any information from policy documents yet. Please upload some documents so I can provide more accurate responses.";
    }
    
    const bestMatches = findBestMatch(query, allSections);
    
    if (bestMatches.length > 0) {
      console.log(`Found ${bestMatches.length} relevant sections for the query`);
      
      let context = "";
      
      for (const match of bestMatches) {
        const docInfo = match.fileName ? `[Source: ${match.fileName}] ` : '';
        const positionInfo = match.position ? `[Page: ${match.position.startPage}] ` : '';
        const sectionText = `${docInfo}${positionInfo}${match.title}\n${match.content}`;
        
        if (context.length + sectionText.length + 2 < 40000) {
          context += sectionText + "\n\n";
        } else {
          console.log("Context size limit reached, truncating...");
          break;
        }
      }
      
      console.log(`Final context length: ${context.length} characters`);
      
      try {
        console.log("Sending query to DeepSeek with targeted context");
        const { data, error } = await supabase.functions.invoke('deepseek-chat', {
          body: { query, context, documentInfo }
        });

        if (error) {
          console.error("Error invoking DeepSeek function with context:", error);
          throw new Error(error.message || "Failed to get response from AI");
        }
        
        if (!data || !data.answer) {
          console.error("Missing answer in DeepSeek response");
          throw new Error("Invalid response from AI service");
        }
        
        return data.answer;
      } catch (err) {
        console.error("Error calling DeepSeek API with context:", err);
        
        return `Based on the policy documents, here's what I found:\n\n${bestMatches[0].content}`;
      }
    } else {
      console.log("No specific matches found. Using general context");
      
      const documentIdsSeen = new Set<string>();
      const generalSections = allSections.filter(section => {
        if (!section.documentId || documentIdsSeen.has(section.documentId)) return false;
        documentIdsSeen.add(section.documentId);
        return true;
      }).slice(0, 5);
      
      const generalContext = generalSections
        .map(section => {
          const docInfo = section.fileName ? `[Source: ${section.fileName}] ` : '';
          return `${docInfo}${section.title}\n${section.content}`;
        })
        .join('\n\n');
        
      try {
        console.log("Sending query to DeepSeek with general context from multiple documents");
        const { data, error } = await supabase.functions.invoke('deepseek-chat', {
          body: { query, context: generalContext, documentInfo }
        });

        if (error) {
          console.error("Error invoking DeepSeek function with general context:", error);
          throw new Error(error.message);
        }
        
        return data.answer;
      } catch (err) {
        console.error("Error calling DeepSeek API with general context:", err);
        return "I couldn't find specific information about this in the policy documents. Please check the university handbook or ask an administrator.";
      }
    }
  } catch (error) {
    console.error("Error searching reference documents:", error);
    return "I encountered an error while searching the policy documents. Please try again later.";
  }
};
