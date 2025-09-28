import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useConversation } from '../contexts/ConversationContext'
import { Bot, LogOut, X, Plus, MessageSquare, Trash2, RefreshCw } from 'lucide-react'
import DocumentStatusWidget from './DocumentStatusWidget'
import localStorageService from '../services/localStorage'

const Notification = ({ message, type = 'info', onClose, autoClose = true, duration = 4000 }) => {
  const bgColor = type === 'error' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
  const textColor = type === 'error' ? 'text-red-800' : 'text-blue-800'
  const borderColor = type === 'error' ? 'border-red-200' : 'border-blue-200'

  useEffect(() => {
    if (autoClose && duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [autoClose, duration, onClose])

  return (
    <div className={`fixed top-20 right-4 z-50 p-4 rounded-md border ${bgColor} ${textColor} ${borderColor} shadow-lg max-w-sm animate-in slide-in-from-right-4 fade-in duration-300`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{message}</p>
        <button
          onClick={onClose}
          className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* Progress bar for auto-dismiss */}
      {autoClose && duration > 0 && (
        <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
          <div
            className="bg-current h-1 rounded-full animate-shrink"
            style={{ animationDuration: `${duration}ms` }}
          ></div>
        </div>
      )}
    </div>
  )
}

const Sidebar = ({ isOpen, onClose, className = "", collapsed = false, onToggleCollapse }) => {
  const { user, logout, isAuthenticated } = useAuth()
  const {
    conversations,
    currentConversation,
    startNewChat,
    loadConversation,
    loadConversations,
    deleteConversation,
    generateTitleForConversation,
    loading
  } = useConversation()

  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [notification, setNotification] = useState(null)
  const [showCacheStats, setShowCacheStats] = useState(false)
  const [cacheStats, setCacheStats] = useState(null)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleNewChat = async () => {
    try {
      if (creating) return

      // Check if user is authenticated
      if (!isAuthenticated) {
        setNotification({
          message: "Please sign in to create a new chat",
          type: "error"
        })
        return
      }

      setCreating(true)
      await startNewChat()
      onClose()
    } catch (error) {
      console.error('Failed to create new chat:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleSelectConversation = async (conversationId) => {
    try {
      await loadConversation(conversationId)
      onClose()
    } catch (error) {
      console.error('Failed to load conversation:', error)
    }
  }

  const handleDeleteConversation = async (conversationId, e) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      try {
        await deleteConversation(conversationId)
      } catch (error) {
        console.error('Failed to delete conversation:', error)
      }
    }
  }

  const handleRefreshConversations = async () => {
    if (refreshing) return
    
    try {
      setRefreshing(true)
      await loadConversations(true) // Force refresh from API
      updateCacheStats()
      setNotification({
        message: "Conversations refreshed successfully",
        type: "info"
      })
    } catch (error) {
      console.error('Failed to refresh conversations:', error)
      setNotification({
        message: "Failed to refresh conversations",
        type: "error"
      })
    } finally {
      setRefreshing(false)
    }
  }


  const updateCacheStats = () => {
    const stats = localStorageService.getCacheStats()
    setCacheStats(stats)
  }

  // Update cache stats when conversations change
  useEffect(() => {
    updateCacheStats()
  }, [conversations])

  const closeNotification = () => {
    setNotification(null)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 ${collapsed ? 'w-20' : 'w-80'} bg-white border-r border-gray-200 transform ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${className} flex flex-col`}>

        {/* Header */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} h-16 px-4 border-b border-gray-200 flex-shrink-0`}>
          <div className={`flex items-center ${collapsed ? 'hidden lg:flex' : 'flex'}`}>
            <Bot className="h-6 w-6 text-blue-600 mr-2" />
            {!collapsed && <span className="text-sm font-semibold">SnapTest</span>}
          </div>
          <div className="flex items-center">
            <button
              onClick={onToggleCollapse}
              className="hidden lg:inline-flex p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M3.75 4.5a.75.75 0 01.75-.75h15a.75.75 0 01.75.75v15a.75.75 0 01-.75.75h-15a.75.75 0 01-.75-.75v-15zm9.22 3.22a.75.75 0 10-1.06-1.06l-3.75 3.75a.75.75 0 000 1.06l3.75 3.75a.75.75 0 001.06-1.06L9.31 12l3.66-3.28z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500"
              aria-label="Close sidebar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* AI Sidebar */}
          <nav className={`mt-8 ${collapsed ? 'px-2' : 'px-4'} flex-1 overflow-y-auto`}>
            <div className="space-y-2">
              <button
                className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} px-4 py-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors bg-blue-50 text-blue-600 ${collapsed ? '' : 'border-r-2 border-blue-600'}`}
                onClick={handleNewChat}
                disabled={creating}
              >
                <Plus className={`h-5 w-5 ${collapsed ? '' : 'mr-3'}`} />
                {!collapsed && (creating ? 'Creating...' : 'New Chat')}
              </button>
              {!collapsed && (
                <div className="mt-4">
                  <DocumentStatusWidget onViewDashboard={() => navigate('/documents')} />
                </div>
              )}
              <div className="mt-6">
                {collapsed ? (
                  <div className="flex flex-col items-center space-y-3 text-gray-500">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent</p>
                      <div className="flex items-center space-x-1">
                        {cacheStats && (
                          <div 
                            className="relative"
                            onMouseEnter={() => setShowCacheStats(true)}
                            onMouseLeave={() => setShowCacheStats(false)}
                          >
                            <div className={`h-2 w-2 rounded-full ${cacheStats.conversationsListValid ? 'bg-green-400' : 'bg-orange-400'}`} 
                                 title="Cache status indicator" />
                            {showCacheStats && (
                              <div className="absolute top-full right-0 mt-1 bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50">
                                Cached: {cacheStats.conversationsCount} conversations<br/>
                                Status: {cacheStats.conversationsListValid ? 'Fresh' : 'Stale'}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          onClick={handleRefreshConversations}
                          disabled={refreshing}
                          className={`p-1 rounded hover:bg-gray-100 transition-colors ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Refresh conversations"
                        >
                          <RefreshCw className={`h-3 w-3 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {loading ? (
                        <div className="px-4 py-2 text-sm text-gray-500">Loading conversations...</div>
                      ) : conversations.length === 0 ? (
                        <div className="px-4 py-2 text-sm text-gray-500">No conversations yet</div>
                      ) : (
                        conversations.map((conversation) => (
                          <div
                            key={conversation._id}
                            className={`group relative px-4 py-2 text-sm rounded hover:bg-gray-50 cursor-pointer flex items-center justify-between ${
                              currentConversation?._id === conversation._id ? 'bg-blue-50 text-blue-600' : 'text-gray-600'
                            }`}
                            onClick={() => handleSelectConversation(conversation._id)}
                          >
                            <div className="flex items-center min-w-0 flex-1">
                              <MessageSquare className="h-4 w-4 mr-2 text-gray-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{conversation.title || conversation.lastMessagePreview || 'New Chat'}</div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => handleDeleteConversation(conversation._id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-600 rounded transition-all"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </nav>
        </div>

        {/* User info and logout - Fixed at bottom */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
            <div className={`flex items-center ${collapsed ? '' : ''}`}>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              {!collapsed && (
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.profile?.firstName} {user?.profile?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">@{user?.username}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className={`inline-flex items-center px-3 py-2 text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors ${collapsed ? '' : ''}`}
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
              {!collapsed && <span className="ml-2">Logout</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={closeNotification}
        />
      )}
    </>
  )
}

export default Sidebar
