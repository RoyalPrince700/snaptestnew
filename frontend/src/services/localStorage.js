/**
 * Local Storage Service for caching conversations and improving performance
 */

const STORAGE_KEYS = {
  CONVERSATIONS: 'snaptest_conversations',
  CONVERSATION_CACHE: 'snaptest_conversation_cache',
  CACHE_METADATA: 'snaptest_cache_metadata'
};

const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_CACHED_CONVERSATIONS = 10; // Maximum number of full conversations to cache

class LocalStorageService {
  
  /**
   * Get conversations list from localStorage
   */
  getConversationsList() {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      if (cached) {
        const data = JSON.parse(cached);
        if (this.isValidCache(data.timestamp)) {
          return data.conversations;
        }
      }
    } catch (error) {
      console.error('[LocalStorage] Error reading conversations list:', error);
    }
    return null;
  }

  /**
   * Save conversations list to localStorage
   */
  saveConversationsList(conversations) {
    try {
      const data = {
        conversations,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('[LocalStorage] Error saving conversations list:', error);
      return false;
    }
  }

  /**
   * Get a specific conversation from cache
   */
  getCachedConversation(conversationId) {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CONVERSATION_CACHE);
      if (cached) {
        const cache = JSON.parse(cached);
        const conversation = cache[conversationId];
        
        if (conversation && this.isValidCache(conversation.timestamp)) {
          return conversation.data;
        }
      }
    } catch (error) {
      console.error('[LocalStorage] Error reading cached conversation:', error);
    }
    return null;
  }

  /**
   * Cache a specific conversation
   */
  cacheConversation(conversationId, conversationData) {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CONVERSATION_CACHE);
      let cache = {};
      
      if (cached) {
        cache = JSON.parse(cached);
      }

      // Add new conversation to cache
      cache[conversationId] = {
        data: conversationData,
        timestamp: Date.now()
      };

      // Clean up old entries if cache is too large
      this.cleanupConversationCache(cache);

      localStorage.setItem(STORAGE_KEYS.CONVERSATION_CACHE, JSON.stringify(cache));
      return true;
    } catch (error) {
      console.error('[LocalStorage] Error caching conversation:', error);
      return false;
    }
  }

  /**
   * Update a conversation in both the list and cache
   */
  updateConversation(updatedConversation) {
    try {
      // Update in conversations list
      const listData = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      if (listData) {
        const parsed = JSON.parse(listData);
        const updatedConversations = parsed.conversations.map(conv => 
          conv._id === updatedConversation._id ? { ...conv, ...updatedConversation } : conv
        );
        
        this.saveConversationsList(updatedConversations);
      }

      // Update in conversation cache if it exists
      const cacheData = localStorage.getItem(STORAGE_KEYS.CONVERSATION_CACHE);
      if (cacheData) {
        const cache = JSON.parse(cacheData);
        if (cache[updatedConversation._id]) {
          cache[updatedConversation._id] = {
            data: updatedConversation,
            timestamp: Date.now()
          };
          localStorage.setItem(STORAGE_KEYS.CONVERSATION_CACHE, JSON.stringify(cache));
        }
      }

      return true;
    } catch (error) {
      console.error('[LocalStorage] Error updating conversation:', error);
      return false;
    }
  }

  /**
   * Add a new conversation to the cached list
   */
  addConversation(newConversation) {
    try {
      const listData = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      if (listData) {
        const parsed = JSON.parse(listData);
        const updatedConversations = [newConversation, ...parsed.conversations];
        this.saveConversationsList(updatedConversations);
      } else {
        // Create new list with just this conversation
        this.saveConversationsList([newConversation]);
      }
      return true;
    } catch (error) {
      console.error('[LocalStorage] Error adding conversation:', error);
      return false;
    }
  }

  /**
   * Remove a conversation from cache and list
   */
  removeConversation(conversationId) {
    try {
      // Remove from conversations list
      const listData = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      if (listData) {
        const parsed = JSON.parse(listData);
        const filteredConversations = parsed.conversations.filter(conv => conv._id !== conversationId);
        this.saveConversationsList(filteredConversations);
      }

      // Remove from conversation cache
      const cacheData = localStorage.getItem(STORAGE_KEYS.CONVERSATION_CACHE);
      if (cacheData) {
        const cache = JSON.parse(cacheData);
        delete cache[conversationId];
        localStorage.setItem(STORAGE_KEYS.CONVERSATION_CACHE, JSON.stringify(cache));
      }

      return true;
    } catch (error) {
      console.error('[LocalStorage] Error removing conversation:', error);
      return false;
    }
  }

  /**
   * Clear all cached data (useful for logout or cache reset)
   */
  clearCache() {
    try {
      localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
      localStorage.removeItem(STORAGE_KEYS.CONVERSATION_CACHE);
      localStorage.removeItem(STORAGE_KEYS.CACHE_METADATA);
      return true;
    } catch (error) {
      console.error('[LocalStorage] Error clearing cache:', error);
      return false;
    }
  }

  /**
   * Check if cached data is still valid
   */
  isValidCache(timestamp) {
    return Date.now() - timestamp < CACHE_EXPIRY;
  }

  /**
   * Clean up old entries from conversation cache
   */
  cleanupConversationCache(cache) {
    const entries = Object.entries(cache);
    
    // Remove expired entries
    const validEntries = entries.filter(([_, data]) => this.isValidCache(data.timestamp));
    
    // If still too many entries, keep only the most recent ones
    if (validEntries.length > MAX_CACHED_CONVERSATIONS) {
      validEntries.sort(([_, a], [__, b]) => b.timestamp - a.timestamp);
      const keepEntries = validEntries.slice(0, MAX_CACHED_CONVERSATIONS);
      
      // Clear the cache and rebuild with only the entries to keep
      Object.keys(cache).forEach(key => delete cache[key]);
      keepEntries.forEach(([id, data]) => {
        cache[id] = data;
      });
    } else {
      // Just remove expired entries
      entries.forEach(([id, data]) => {
        if (!this.isValidCache(data.timestamp)) {
          delete cache[id];
        }
      });
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    try {
      const conversationsData = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      const cacheData = localStorage.getItem(STORAGE_KEYS.CONVERSATION_CACHE);
      
      const stats = {
        hasConversationsList: !!conversationsData,
        conversationsCount: 0,
        cachedConversationsCount: 0,
        cacheSize: 0
      };

      if (conversationsData) {
        const parsed = JSON.parse(conversationsData);
        stats.conversationsCount = parsed.conversations?.length || 0;
        stats.conversationsListAge = Date.now() - (parsed.timestamp || 0);
        stats.conversationsListValid = this.isValidCache(parsed.timestamp || 0);
      }

      if (cacheData) {
        const cache = JSON.parse(cacheData);
        stats.cachedConversationsCount = Object.keys(cache).length;
        stats.cacheSize = JSON.stringify(cache).length;
      }

      return stats;
    } catch (error) {
      console.error('[LocalStorage] Error getting cache stats:', error);
      return null;
    }
  }
}

export default new LocalStorageService();
