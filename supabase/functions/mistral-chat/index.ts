
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  
  // Initialize Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") as string;
  const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
  
  // Use service role key for admin privileges to bypass RLS
  const supabase = createClient(supabaseUrl, supabaseServiceRole || supabaseAnonKey);
  
  const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
  const mistralApiKey = Deno.env.get('MISTRAL_API_KEY');
  
  if (!openrouterApiKey && !mistralApiKey) {
    return new Response(JSON.stringify({
      error: 'No API key configured (OpenRouter or Mistral)'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }

  try {
    const { messages, context, sessionId, userId } = await req.json();
    console.log('Received chat request with', messages.length, 'messages');
    console.log('Session ID:', sessionId, 'User ID:', userId);
    
    // Format the conversation for API
    const formattedMessages = messages.map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
    }));
    
    // Add system message with context if provided
    if (context) {
      formattedMessages.unshift({
        role: 'system',
        content: `You are Poli, the New Era University Policy Assistant, designed to help users find and understand NEU's policies.\nUse this context to help answer questions: ${context}\nIf a user asks a question that is not related to New Era University, its policies, or academic life, politely respond: Sorry, I can only answer questions about New Era University and its policies.`
      });
    } else {
      formattedMessages.unshift({
        role: 'system',
        content: `You are Poli, the New Era University Policy Assistant, designed to help users find and understand NEU's policies. Be helpful, clear, and concise. If a user asks a question that is not related to New Era University, its policies, or academic life, politely respond: Sorry, I can only answer questions about New Era University and its policies. If you don't know something, admit it and suggest where they might find the information.`
      });
    }
    
    let answer;
    let modelUsed;
    
    // Use Mistral API if key is available, otherwise fallback to OpenRouter
    if (mistralApiKey) {
      console.log('Using Mistral API');
      modelUsed = 'mistral';
      
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mistralApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'mistral-large-latest',
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 1024
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Mistral API error:', response.status, errorText);
        throw new Error(`Failed to get response from Mistral: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      answer = data.choices[0].message.content;
    } else {
      console.log('Using OpenRouter API (fallback)');
      modelUsed = 'openrouter';
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat-v3-0324:free',
          messages: formattedMessages,
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error:', response.status, errorText);
        throw new Error(`Failed to get response from OpenRouter: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      answer = data.choices[0].message.content;
    }
    
    console.log('Received answer from AI');
    
    // Save message to chat history if sessionId is provided
    if (sessionId) {
      try {
        console.log('Saving messages to chat history');
        
        // Create or update session as needed
        if (userId) {
          // Check if session already exists
          const { data: sessionExists } = await supabase
            .from('chat_sessions')
            .select('id')
            .eq('id', sessionId)
            .single();
            
          if (!sessionExists) {
            console.log('Creating new chat session');
            // Get the most recent user message for the title
            const userMessages = messages.filter(msg => msg.sender === 'user');
            const latestUserMsg = userMessages[userMessages.length - 1];
            const sessionTitle = latestUserMsg 
              ? latestUserMsg.text.substring(0, 50) + (latestUserMsg.text.length > 50 ? '...' : '')
              : 'New Chat';
              
            await supabase
              .from('chat_sessions')
              .insert({
                id: sessionId,
                title: sessionTitle,
                user_id: userId
              });
          }
        }
        
        // Get the last user message (the one being responded to)
        const userMessages = messages.filter(msg => msg.sender === 'user');
        const latestUserMsg = userMessages[userMessages.length - 1];
        
        // Save the user message if it exists
        if (latestUserMsg) {
          console.log('Saving user message:', latestUserMsg.text.substring(0, 20) + '...');
          const { error: userMsgError } = await supabase.from('chat_messages').insert({
            session_id: sessionId,
            sender: 'user',
            content: latestUserMsg.text,
            timestamp: new Date().toISOString()
          });
          
          if (userMsgError) {
            console.error('Error saving user message:', userMsgError);
          }
        }
        
        // Save the bot response
        console.log('Saving bot response');
        const { error: botMsgError } = await supabase.from('chat_messages').insert({
          session_id: sessionId,
          sender: 'bot',
          content: answer,
          timestamp: new Date().toISOString()
        });
        
        if (botMsgError) {
          console.error('Error saving bot message:', botMsgError);
        }
        
        // Update the session's title if it's a new session
        if (sessionId && latestUserMsg) {
          const { data: sessionData } = await supabase
            .from('chat_sessions')
            .select('title')
            .eq('id', sessionId)
            .single();
            
          if (sessionData && sessionData.title === 'New Chat') {
            const userQuery = latestUserMsg.text;
            await supabase.from('chat_sessions').update({
              title: userQuery.substring(0, 50) + (userQuery.length > 50 ? '...' : ''),
            }).eq('id', sessionId);
          }
        }
        
        console.log('Successfully saved chat messages');
      } catch (error) {
        console.error('Error saving chat history:', error);
        // Continue even if saving fails - don't block the response
      }
    }
    
    return new Response(JSON.stringify({
      answer,
      context: [],
      model: modelUsed
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in mistral-chat function:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
