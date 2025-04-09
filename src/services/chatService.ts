
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
  // First check if user has an empty active session
  const { data: existingSessions } = await supabase
    .from('chat_sessions')
    .select('id, chat_messages(count)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
    
  // If there's an active session with no messages (except welcome), reuse it
  if (existingSessions && existingSessions.length > 0) {
    const existingSession = existingSessions[0];
    const messageCount = existingSession.chat_messages[0]?.count || 0;
    
    if (messageCount <= 1) { // Only welcome message or no messages
      return existingSession as ChatSession;
    }
  }
  
  // No reusable session found, create a new one
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
    // Extract key phrases (3-5 words) that summarize the topic
    const cleanUserMessage = userMessage.replace(/[^\w\s]/gi, '').toLowerCase();
    const words = cleanUserMessage.split(/\s+/);
    
    // Filter out common stop words
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'about', 'to', 'from', 'how', 'what', 'when', 'where', 'who', 'why', 'can', 'could', 'would', 'should', 'do', 'does', 'did'];
    const significantWords = words.filter(word => 
      word.length > 2 && !stopWords.includes(word)
    );
    
    // Try to find policy-related terms in the bot response
    let policyTerms = [];
    if (botResponse) {
      const keyTerms = ['policy', 'regulation', 'procedure', 'guideline', 'rule', 'requirement'];
      
      for (const term of keyTerms) {
        const regex = new RegExp(`(\\w+\\s+){0,2}${term}(\\s+\\w+){0,2}`, 'gi');
        const matches = botResponse.match(regex);
        if (matches && matches.length > 0) {
          // Take the shortest match that's not just the term itself
          const validMatches = matches
            .filter(m => m.length > term.length + 2)
            .sort((a, b) => a.length - b.length);
          
          if (validMatches.length > 0) {
            const match = validMatches[0].trim();
            // Make sure it's not too long
            const words = match.split(/\s+/);
            if (words.length <= 5) {
              policyTerms.push(match);
              break; // Found a good policy term
            }
          }
        }
      }
    }
    
    if (policyTerms.length > 0) {
      // Use the policy term as the title (already limited to 3-5 words)
      return policyTerms[0].charAt(0).toUpperCase() + policyTerms[0].slice(1);
    }
    
    // Get key nouns and topic words
    if (significantWords.length > 0) {
      // Take up to 5 significant words
      const titleWords = significantWords.slice(0, 5);
      
      // Format title with first letter capitalized
      const title = titleWords.join(' ');
      return title.charAt(0).toUpperCase() + title.slice(1);
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
  console.log("Finding relevant information for query:", query);
  console.log("Reference documents available:", referenceDocuments.length);
  
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
      try {
        console.log(`Processing document: ${doc.file_name}`);
        
        // Get a signed URL for the document
        const { data: fileData } = await supabase.storage
          .from('policy_documents')
          .createSignedUrl(doc.file_path, 3600);
          
        if (!fileData?.signedUrl) {
          console.error(`Could not get signed URL for ${doc.file_path}`);
          continue;
        }
        
        // Extract text from the PDF
        const text = await extractTextFromPDF(fileData.signedUrl);
        console.log(`Extracted text length: ${text.length} characters from ${doc.file_name}`);
        
        // Extract sections from the text
        const sections = extractDocumentSections(text);
        allSections.push(...sections);
        console.log(`Extracted ${sections.length} sections from ${doc.file_name}`);
      } catch (err) {
        console.error(`Error processing document ${doc.file_name}:`, err);
      }
    }
    
    console.log(`Total sections available: ${allSections.length}`);
    
    if (allSections.length === 0) {
      return "I don't have any information from policy documents yet. Please upload some documents so I can provide more accurate responses.";
    }
    
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
