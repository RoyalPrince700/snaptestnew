import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useConversation } from '../contexts/ConversationContext'
import { uploadService, ingestService } from '../services/api'
import { Bot, Send, Paperclip, FileText, Image, X, Loader } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import ReactMarkdown from 'react-markdown'
import Answer from '../components/Answer'
import EnhancedAnswer from '../components/EnhancedAnswer'
import DocumentStatusWidget from '../components/DocumentStatusWidget'
import DocumentDashboard from '../components/DocumentDashboard'

const Home = () => {
  const { user } = useAuth()
  const {
    currentConversation,
    messages,
    sendMessage,
    loading,
    error,
    startNewChat,
    setActiveDocument
  } = useConversation()
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [filePreview, setFilePreview] = useState(null)
  const [showDocumentDashboard, setShowDocumentDashboard] = useState(false)
  const [ingestionStatus, setIngestionStatus] = useState(null) // { fileName, chunksStored, isWaiting }
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => { scrollToBottom() }, [messages])

  // File handling functions
  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp']
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a PDF or image file (JPG, PNG, GIF, BMP)')
        return
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB')
        return
      }

      setSelectedFile(file)

      // Create file preview
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          setFilePreview({
            type: 'image',
            url: e.target.result,
            name: file.name,
            size: file.size
          })
        }
        reader.readAsDataURL(file)
      } else {
        setFilePreview({
          type: 'pdf',
          name: file.name,
          size: file.size
        })
      }
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) return

    try {
      setIsUploadingFile(true)

      // First, add a user message indicating file upload
      const fileMessage = {
        role: 'user',
        content: `📎 Uploaded: ${selectedFile.name}`,
        timestamp: new Date().toISOString(),
        type: 'file',
        file: filePreview
      }

      // Add the file upload message to the conversation (auto-creates if needed)
      await sendMessage(fileMessage.content, currentConversation?._id)

      // Generate a unique document ID for this upload
      const docId = uuidv4()

      // Use ingest service to process the file for content analysis
      const fileName = selectedFile.name
      const response = await ingestService.ingestFile(selectedFile, docId)

      console.log('Ingestion completed:', response)
      console.log('Document chunks stored:', response.data?.chunksStored || 0)
      console.log('Document ID:', docId)

      // Set this document as active for the current conversation
      if (currentConversation?._id) {
        try {
          await setActiveDocument(currentConversation._id, docId)
          console.log('Set active document for conversation:', currentConversation._id, 'docId:', docId)
        } catch (error) {
          console.error('Failed to set active document:', error)
          // Don't fail the upload process if this fails
        }
      }

      // Show ingestion status
      setIngestionStatus({
        fileName,
        chunksStored: response.data?.chunksStored || 0,
        isWaiting: true
      })

      // Clear file selection
      setSelectedFile(null)
      setFilePreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Add a longer delay to ensure vector search index is fully updated
      console.log('Waiting for vector index to update...')
      await new Promise(resolve => setTimeout(resolve, 8000)) // Increased to 8 seconds

      // Update status to show waiting is complete
      setIngestionStatus(prev => prev ? { ...prev, isWaiting: false } : null)

      // Send a follow-up message asking AI to explain the content with specific document reference
      console.log('Sending AI request for document:', fileName)
      const contentExplanationRequest = `I just uploaded and ingested a document called "${fileName}" (${response.data?.chunksStored || 0} chunks stored with document ID: ${docId}). Please search your knowledge base for content related to "${fileName}" and explain what this document is about. What are the key topics, concepts, or information covered? Focus on the main subject matter and important details.`

      await sendMessage(contentExplanationRequest, currentConversation?._id)
      
      // Clear status after sending message
      setTimeout(() => setIngestionStatus(null), 3000)

    } catch (error) {
      console.error('File upload error:', error)
      alert('Failed to upload file. Please try again.')
    } finally {
      setIsUploadingFile(false)
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    setFilePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // No automatic conversation creation - let user click "New Chat" button

  const handleSendMessage = async (e) => {
    e.preventDefault()

    // Handle file upload if file is selected
    if (selectedFile) {
      await handleFileUpload()
      return
    }

    // Handle text message - auto-create conversation if needed
    if (!input.trim() || isSending) return

    const messageText = input.trim()
    setInput('')

    try {
      setIsSending(true)
      // sendMessage will auto-create conversation if needed
      await sendMessage(messageText, currentConversation?._id)
    } catch (error) {
      console.error('Chat error:', error)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex h-full bg-white">
      {/* Main content only, global Sidebar is used */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex h-full">
          <div className="flex-1 flex flex-col">

            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
              {messages.length === 0 && !loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-2xl mx-auto">
                    <div className="relative">
                      <Bot className="h-16 w-16 text-indigo-400 mx-auto mb-4" />
                      <div className="absolute -top-2 -right-2 text-2xl">🎓</div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Welcome to SnapTest Chat! ✨</h3>
                    <p className="text-gray-600 mb-4">I'm your fun AI tutor ready to make learning exciting! 🚀</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                        <div className="text-blue-600 font-semibold mb-1">📚 Ask me anything!</div>
                        <div className="text-blue-500 text-xs">Math, Science, History, Literature...</div>
                      </div>
                      <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3">
                        <div className="text-purple-600 font-semibold mb-1">🧠 Visual Learning</div>
                        <div className="text-purple-500 text-xs">Mind maps, sticky notes, fun facts!</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-sm md:max-w-2xl lg:max-w-4xl xl:max-w-5xl px-4 py-3 rounded-lg ${
                      message.role === 'user' 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md' 
                        : 'bg-gradient-to-r from-indigo-50 to-purple-50 text-gray-900 border-2 border-indigo-200 shadow-sm'
                    }`}>
                      {message.role === 'user' ? (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <>
                          <div className="flex items-center mb-2">
                            <div className="relative">
                              <Bot className="h-5 w-5 mr-2 text-indigo-600" />
                              <div className="absolute -top-1 -right-1 text-xs">🎓</div>
                            </div>
                            <span className="text-xs font-semibold text-indigo-700">AI Tutor ✨</span>
                          </div>
                          {Array.isArray(message.citations) || message.uncertainty ? (
                            <EnhancedAnswer data={{ answer: message.content, citations: message.citations, uncertainty: message.uncertainty }} />
                          ) : (
                            <EnhancedAnswer data={{ answer: message.content, citations: [], uncertainty: null }} />
                          )}
                          <p className="text-xs opacity-50 mt-1">{new Date(message.timestamp).toLocaleTimeString()}</p>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}

              {isSending && currentConversation && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-3 rounded-lg">
                    <div className="flex items-center">
                      <Bot className="h-4 w-4 mr-2" />
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex justify-center">
                  <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-lg">
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="bg-white border-t border-gray-200 p-4 md:p-6 lg:p-8">
              {/* File Preview */}
              {filePreview && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {filePreview.type === 'image' ? (
                        <Image className="h-8 w-8 text-blue-600" />
                      ) : (
                        <FileText className="h-8 w-8 text-red-600" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{filePreview.name}</p>
                        <p className="text-xs text-gray-600">
                          {(filePreview.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={removeFile}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {filePreview.type === 'image' && (
                    <div className="mt-2">
                      <img
                        src={filePreview.url}
                        alt="File preview"
                        className="max-h-32 max-w-full object-contain rounded"
                      />
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex space-x-3">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="chat-file-input"
                />

                {/* Attachment button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFile}
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Attach file"
                >
                  <Paperclip className="h-5 w-5" />
                </button>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    selectedFile
                      ? "Click send to upload file"
                      : "Type a message or click 📎 to attach a file..."
                  }
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isUploadingFile}
                />

                <button
                  type="submit"
                  disabled={
                    isSending ||
                    isUploadingFile ||
                    (!input.trim() && !selectedFile)
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  {isUploadingFile ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>{isUploadingFile ? 'Uploading...' : 'Send'}</span>
                </button>
              </form>
            </div>
          </div>
          
          {/* Right Sidebar removed: Document status moved into left sidebar */}
        </div>
      </div>

      {/* Document Dashboard Modal */}
      {showDocumentDashboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">Document Dashboard</h2>
                <button
                  onClick={() => setShowDocumentDashboard(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <DocumentDashboard />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
