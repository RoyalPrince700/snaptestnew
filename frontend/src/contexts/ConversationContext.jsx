import { createContext, useContext, useReducer, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import localStorageService from '../services/localStorage';
import { cleanAIResponse, cleanEmojiSequences } from '../utils/textCleaner';

const ConversationContext = createContext();

const initialState = {
  conversations: [],
  currentConversation: null,
  messages: [],
  loading: false,
  error: null
};

const conversationReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload, loading: false };
    
    case 'SET_CURRENT_CONVERSATION':
      return { 
        ...state, 
        currentConversation: action.payload,
        messages: action.payload?.messages || []
      };
    
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload]
      };
    
    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map(conv => 
          conv._id === action.payload._id ? action.payload : conv
        ),
        currentConversation: state.currentConversation?._id === action.payload._id 
          ? action.payload 
          : state.currentConversation
      };
    
    case 'ADD_CONVERSATION':
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
        currentConversation: action.payload,
        messages: action.payload.messages || []
      };
    
    case 'DELETE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.filter(conv => conv._id !== action.payload),
        currentConversation: state.currentConversation?._id === action.payload 
          ? null 
          : state.currentConversation,
        messages: state.currentConversation?._id === action.payload ? [] : state.messages
      };
    
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };
    
    default:
      return state;
  }
};

export const ConversationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(conversationReducer, initialState);
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Load conversations only when user is authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      // Small delay to ensure auth headers are properly set
      const timer = setTimeout(() => {
        loadConversations();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, authLoading]);

  const loadConversations = async (forceRefresh = false) => {
    if (!isAuthenticated) {
      return; // Don't make API calls if not authenticated
    }
    
    try {
      console.debug('[Conversation] Loading conversations...')
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Try to load from cache first (unless forced refresh)
      if (!forceRefresh) {
        const cachedConversations = localStorageService.getConversationsList();
        if (cachedConversations) {
          console.debug('[Conversation] Loaded from cache:', cachedConversations.length);
          dispatch({ type: 'SET_CONVERSATIONS', payload: cachedConversations });
          dispatch({ type: 'SET_LOADING', payload: false });
          return;
        }
      }
      
      // Load from API
      const response = await api.get('/conversations');
      console.debug('[Conversation] Conversations loaded from API:', Array.isArray(response.data.data) ? response.data.data.length : 'unknown');
      
      const conversations = response.data.data;
      
      // Cache the conversations
      localStorageService.saveConversationsList(conversations);
      
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
      
      // Auto-generate titles for conversations that still have "New Chat" (only if not forced refresh)
      if (!forceRefresh) {
        const conversationsNeedingTitles = conversations.filter(conv => conv.title === 'New Chat');
        if (conversationsNeedingTitles.length > 0) {
          console.debug(`[Conversation] Auto-generating titles for ${conversationsNeedingTitles.length} conversations...`);
          // Process in background without blocking the UI
          conversationsNeedingTitles.forEach(async (conversation) => {
            try {
              await generateTitleForConversation(conversation._id);
            } catch (error) {
              console.warn(`[Conversation] Failed to auto-generate title for ${conversation._id}:`, error);
            }
          });
        }
      }
      
      // Auto-create a conversation if user has no existing conversations
      if (conversations.length === 0) {
        console.debug('[Conversation] No conversations found, creating default conversation...');
        try {
          const newConversation = await createConversation('Welcome Chat');
          console.debug('[Conversation] Default conversation created:', newConversation._id);
        } catch (createError) {
          console.error('[Conversation] Failed to create default conversation:', createError);
          // Don't throw here, let the user manually create a conversation if needed
        }
      }
    } catch (error) {
      console.error('[Conversation] Failed to load conversations:', error.response?.data || error.message);
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to load conversations' });
    }
  };

  const createConversation = async (title = 'New Chat') => {
    if (!isAuthenticated) {
      throw new Error('User not authenticated');
    }
    
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await api.post('/conversations', { title });
      // Update cache
      localStorageService.addConversation(response.data.data);
      
      dispatch({ type: 'ADD_CONVERSATION', payload: response.data.data });
      dispatch({ type: 'SET_LOADING', payload: false });
      return response.data.data;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to create conversation' });
      throw error;
    }
  };

  const loadConversation = async (conversationId) => {
    try {
      console.debug('[Conversation] Loading conversation', conversationId)
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Try to load from cache first
      const cachedConversation = localStorageService.getCachedConversation(conversationId);
      if (cachedConversation) {
        console.debug('[Conversation] Loaded conversation from cache:', conversationId)
        dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: cachedConversation });
        dispatch({ type: 'SET_LOADING', payload: false });
        return cachedConversation;
      }
      
      // Load from API if not in cache
      const response = await api.get(`/conversations/${conversationId}`);
      console.debug('[Conversation] Conversation loaded from API:', response.data?.data?._id)
      
      // Cache the conversation
      localStorageService.cacheConversation(conversationId, response.data.data);
      
      dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: response.data.data });
      dispatch({ type: 'SET_LOADING', payload: false });
      return response.data.data;
    } catch (error) {
      console.error('[Conversation] Failed to load conversation:', error.response?.data || error.message)
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to load conversation' });
      throw error;
    }
  };

  const sendMessage = async (message, conversationId = null) => {
    try {
      let targetConversationId = conversationId || state.currentConversation?._id;
      
      // Auto-create a conversation if none exists
      if (!targetConversationId) {
        console.debug('[Conversation] No conversation found, creating new conversation...');
        const newConversation = await createConversation('New Chat');
        targetConversationId = newConversation._id;
      }

      // Set loading state
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // Add user message to UI immediately
      const userMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      console.debug('[Conversation] → Sending message', {
        conversationId: targetConversationId,
        contentPreview: message?.slice(0, 80)
      })
      dispatch({ type: 'ADD_MESSAGE', payload: userMessage });

      // Send to API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      try {
        const response = await api.post('/ai/ask-question', {
          question: message,
          conversationId: targetConversationId
        }, {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Add AI response to UI (structured JSON: answer, citations, uncertainty)
        const aiJson = response?.data?.data || {};
        const rawContent = aiJson.answer || '';
        const cleanedContent = cleanEmojiSequences(cleanAIResponse(rawContent));
        
        const aiMessage = {
          role: 'assistant',
          content: cleanedContent,
          citations: Array.isArray(aiJson.citations) ? aiJson.citations : [],
          uncertainty: aiJson.uncertainty || null,
          timestamp: new Date().toISOString()
        };
        console.debug('[Conversation] ← Received AI response', {
          conversationId: targetConversationId,
          contentLength: aiMessage.content?.length,
          citations: aiMessage.citations?.length || 0,
          uncertain: !!aiMessage.uncertainty?.isUncertain
        })
        dispatch({ type: 'ADD_MESSAGE', payload: aiMessage });

        // Update conversation in list
        const updatedConversation = {
          ...state.currentConversation,
          lastMessageAt: new Date().toISOString(),
          lastMessagePreview: message.length > 50 ? message.substring(0, 50) + '...' : message
        };
        
        // Update cache
        localStorageService.updateConversation(updatedConversation);
        
        dispatch({ type: 'UPDATE_CONVERSATION', payload: updatedConversation });

        // Clear loading state
        dispatch({ type: 'SET_LOADING', payload: false });

        return response.data.data;
      } catch (apiError) {
        clearTimeout(timeoutId);
        if (apiError.name === 'AbortError') {
          console.error('[Conversation] × Chat request aborted due to timeout')
        } else {
          console.error('[Conversation] × Chat request failed', apiError.response?.data || apiError.message)
        }
        if (apiError.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.');
        }
        throw apiError;
      }
    } catch (error) {
      // Add error message to UI
      const errorMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date().toISOString(),
        error: true
      };
      console.error('[Conversation] Error in sendMessage:', error.message)
      dispatch({ type: 'ADD_MESSAGE', payload: errorMessage });
      
      // Clear loading state and set error
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to send message' });
      throw error;
    }
  };

  const updateConversationTitle = async (conversationId, title) => {
    try {
      const response = await api.put(`/conversations/${conversationId}`, { title });
      
      // Update cache
      localStorageService.updateConversation(response.data.data);
      
      dispatch({ type: 'UPDATE_CONVERSATION', payload: response.data.data });
      return response.data.data;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to update conversation' });
      throw error;
    }
  };

  const generateTitleForConversation = async (conversationId) => {
    try {
      // Get the conversation to find the first user message
      const response = await api.get(`/conversations/${conversationId}`);
      const conversation = response.data.data;
      
      if (conversation.messages && conversation.messages.length > 0) {
        const firstUserMessage = conversation.messages.find(msg => msg.role === 'user');
        if (firstUserMessage && firstUserMessage.content) {
          // Generate a title from the first user message with proper truncation
          const content = firstUserMessage.content.trim();
          const title = content.length > 60 
            ? content.substring(0, 60) + '...' 
            : content;
          
          // Update the conversation title
          await updateConversationTitle(conversationId, title);
          return title;
        }
      }
    } catch (error) {
      console.error('Failed to generate title for conversation:', error);
      throw error;
    }
  };

  const deleteConversation = async (conversationId) => {
    try {
      await api.delete(`/conversations/${conversationId}`);
      
      // Update cache
      localStorageService.removeConversation(conversationId);
      
      dispatch({ type: 'DELETE_CONVERSATION', payload: conversationId });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to delete conversation' });
      throw error;
    }
  };

  const startNewChat = async () => {
    try {
      const newConversation = await createConversation();
      return newConversation;
    } catch (error) {
      throw error;
    }
  };

  const clearCurrentConversation = () => {
    dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: null });
    dispatch({ type: 'CLEAR_MESSAGES' });
  };

  const clearCache = () => {
    localStorageService.clearCache();
  };

  const setActiveDocument = async (conversationId, docId) => {
    try {
      const response = await api.put(`/conversations/${conversationId}/active-doc`, { docId });
      // Update the current conversation in state if it matches
      if (state.currentConversation?._id === conversationId) {
        dispatch({ 
          type: 'SET_CURRENT_CONVERSATION', 
          payload: { 
            ...state.currentConversation, 
            activeDocId: docId 
          } 
        });
      }
      return response.data.data;
    } catch (error) {
      console.error('[Conversation] Failed to set active document:', error);
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to set active document' });
      throw error;
    }
  };

  const addMessageLocally = (message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  };

  const value = {
    ...state,
    loadConversations,
    createConversation,
    loadConversation,
    sendMessage,
    updateConversationTitle,
    deleteConversation,
    startNewChat,
      clearCurrentConversation,
      clearCache,
      setActiveDocument,
      generateTitleForConversation,
      addMessageLocally
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversation = () => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
};
