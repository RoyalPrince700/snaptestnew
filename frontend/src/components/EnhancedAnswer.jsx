import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import References from './References'
import { ChevronDown, ChevronUp, Lightbulb, BookOpen, Target, Zap, Brain, Star } from 'lucide-react'
import { cleanAIResponse, cleanEmojiSequences, cleanForStickyNote, extractCleanFunFacts } from '../utils/textCleaner'

// Fun educational emojis mapping
const TOPIC_EMOJIS = {
  'solar system': '🌟', 'planets': '🪐', 'sun': '☀️', 'moon': '🌙', 'earth': '🌍', 'mars': '🔴', 'jupiter': '🟠', 'saturn': '💍', 'venus': '💛', 'mercury': '🔥', 'uranus': '💎', 'neptune': '💙',
  'physics': '⚛️', 'chemistry': '🧪', 'biology': '🧬', 'math': '🔢', 'history': '📜', 'geography': '🗺️', 'literature': '📚', 'science': '🔬',
  'space': '🚀', 'astronomy': '🔭', 'gravity': '⬇️', 'orbit': '🔄', 'atmosphere': '🌫️', 'gas': '💨', 'rock': '🪨', 'ice': '🧊', 'storm': '🌪️',
  'years': '📅', 'billion': '💫', 'formation': '✨', 'nebula': '🌌', 'dust': '✨', 'cloud': '☁️', 'massive': '💪', 'largest': '👑', 'smallest': '🤏'
}

// Fun colors for sticky notes
const STICKY_COLORS = [
  'bg-yellow-100 border-yellow-300 text-yellow-900',
  'bg-pink-100 border-pink-300 text-pink-900', 
  'bg-blue-100 border-blue-300 text-blue-900',
  'bg-green-100 border-green-300 text-green-900',
  'bg-purple-100 border-purple-300 text-purple-900',
  'bg-orange-100 border-orange-300 text-orange-900'
]

// Function to detect and add emojis to text
const addTopicEmojis = (text) => {
  let enhancedText = text
  Object.entries(TOPIC_EMOJIS).forEach(([keyword, emoji]) => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
    if (regex.test(enhancedText) && !enhancedText.includes(emoji)) {
      enhancedText = enhancedText.replace(regex, `${keyword} ${emoji}`)
    }
  })
  return enhancedText
}

// Function to break content into fun sections
const parseEducationalContent = (content) => {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
  
  // Group sentences into educational sections
  const sections = []
  let currentSection = []
  
  sentences.forEach((sentence, index) => {
    currentSection.push(sentence.trim())
    
    // Create sections every 2-3 sentences for better digestibility
    if (currentSection.length >= 2 || index === sentences.length - 1) {
      sections.push(currentSection.join('. ') + '.')
      currentSection = []
    }
  })
  
  return sections.filter(section => section.trim().length > 0)
}

// Mind map component for visual learning
const MindMapSection = ({ title, points }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  return (
    <div className="mb-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border-2 border-indigo-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center space-x-2">
          <Brain className="h-5 w-5 text-indigo-600" />
          <h3 className="font-semibold text-indigo-800">{title} 🧠</h3>
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      
      {isExpanded && (
        <div className="mt-3 space-y-2">
          {points.map((point, index) => (
            <div key={index} className="flex items-start space-x-2 ml-4">
              <div className="w-2 h-2 bg-indigo-400 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm text-indigo-700">{addTopicEmojis(point)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Sticky note component
const StickyNote = ({ content, colorIndex, icon: Icon }) => {
  const colorClass = STICKY_COLORS[colorIndex % STICKY_COLORS.length]
  
  return (
    <div className={`p-3 rounded-lg border-2 transform rotate-1 hover:rotate-0 transition-transform duration-200 shadow-md ${colorClass}`}>
      <div className="flex items-start space-x-2">
        {Icon && <Icon className="h-4 w-4 mt-1 flex-shrink-0" />}
        <p className="text-sm font-medium">{addTopicEmojis(content)}</p>
      </div>
    </div>
  )
}

// Fun fact box component
const FunFactBox = ({ fact }) => (
  <div className="bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-300 rounded-lg p-3 my-3">
    <div className="flex items-start space-x-2">
      <Star className="h-5 w-5 text-yellow-600 mt-0.5" />
      <div>
        <h4 className="font-semibold text-yellow-800 mb-1">✨ Fun Fact!</h4>
        <p className="text-sm text-yellow-700">{addTopicEmojis(fact)}</p>
      </div>
    </div>
  </div>
)

// Main enhanced answer component
export default function EnhancedAnswer({ data, onJumpToMessage }) {
  const [activeView, setActiveView] = useState('fun') // 'fun' or 'mindmap'
  
  if (!data || typeof data !== 'object') return null
  const { answer, citations = [], uncertainty } = data

  const isUncertain = !!uncertainty?.isUncertain
  const reasons = Array.isArray(uncertainty?.reasons) ? uncertainty.reasons : []
  
  // Clean the AI response text first
  const cleanedAnswer = cleanEmojiSequences(cleanAIResponse(answer || ''))
  
  // Parse content into educational sections
  const sections = parseEducationalContent(cleanedAnswer)
  
  // Create mind map structure for complex topics
  const createMindMap = (content) => {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const mindMapSections = []
    
    // Detect main topics (simple heuristic)
    let currentTopic = "Key Concepts"
    let currentPoints = []
    
    sentences.forEach((sentence, index) => {
      const trimmed = sentence.trim()
      if (trimmed.length > 0) {
        // Check if this might be a new topic (contains certain keywords)
        const topicKeywords = ['The', 'Our', 'These', 'There are', 'Four', 'Eight', 'Also']
        const startsNewTopic = topicKeywords.some(keyword => trimmed.startsWith(keyword))
        
        if (startsNewTopic && currentPoints.length > 0) {
          mindMapSections.push({ title: currentTopic, points: [...currentPoints] })
          currentTopic = trimmed.length > 50 ? trimmed.substring(0, 47) + "..." : trimmed
          currentPoints = []
        } else {
          currentPoints.push(trimmed)
        }
      }
    })
    
    if (currentPoints.length > 0) {
      mindMapSections.push({ title: currentTopic, points: currentPoints })
    }
    
    return mindMapSections
  }
  
  const mindMapData = createMindMap(cleanedAnswer)
  
  // Extract and clean fun facts using the utility function
  const funFacts = extractCleanFunFacts(cleanedAnswer)

  return (
    <div className="text-sm">
      {isUncertain && (
        <div className="mb-3 inline-flex items-center px-3 py-2 rounded-lg bg-yellow-50 border-2 border-yellow-200 text-yellow-800 text-xs">
          <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
          🤔 I'm not 100% sure about this
          {reasons.length > 0 && (
            <span className="ml-2 text-[10px] text-yellow-700">({reasons.slice(0, 2).join('; ')}{reasons.length > 2 ? '…' : ''})</span>
          )}
        </div>
      )}

      {/* Fun Header with Personality */}
      <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
        <div className="flex items-center space-x-2 mb-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-blue-800">🎓 Your Personal AI Tutor is Here!</h3>
        </div>
        <p className="text-xs text-blue-600">Ready to make your brain do a happy dance? Let's break this down in the most fun way possible! 🧠✨</p>
      </div>

      {/* View Toggle */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setActiveView('fun')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            activeView === 'fun' 
              ? 'bg-purple-100 text-purple-700 border-2 border-purple-300' 
              : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
          }`}
        >
          🎨 Fun Mode
        </button>
        <button
          onClick={() => setActiveView('mindmap')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            activeView === 'mindmap' 
              ? 'bg-purple-100 text-purple-700 border-2 border-purple-300' 
              : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
          }`}
        >
          🧠 Mind Map
        </button>
      </div>

      {/* Content based on active view */}
      {activeView === 'fun' ? (
        <div className="space-y-4">
          {/* Sticky Notes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sections.slice(0, 6).map((section, index) => (
              <StickyNote
                key={index}
                content={cleanForStickyNote(section)}
                colorIndex={index}
                icon={index === 0 ? Lightbulb : index === 1 ? Target : index === 2 ? Zap : null}
              />
            ))}
          </div>
          
          {/* Fun Facts */}
          {funFacts.map((fact, index) => (
            <FunFactBox key={index} fact={fact} />
          ))}
          
          {/* Additional content if there are more sections */}
          {sections.length > 6 && (
            <div className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                <BookOpen className="h-4 w-4 mr-2" />
                📖 More Details
              </h4>
              <div className="prose prose-sm max-w-none text-gray-700">
                <ReactMarkdown>{addTopicEmojis(cleanForStickyNote(sections.slice(6).join(' ')))}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {mindMapData.map((section, index) => (
            <MindMapSection
              key={index}
              title={section.title}
              points={section.points}
            />
          ))}
        </div>
      )}

      {/* Learning Suggestions */}
      <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
        <div className="flex items-center space-x-2 mb-2">
          <Lightbulb className="h-4 w-4 text-green-600" />
          <h4 className="font-semibold text-green-800">💡 Let's Keep This Learning Party Going!</h4>
        </div>
        <div className="space-y-1 text-xs text-green-700">
          <p>• "Want me to blow your mind with more details?" 🤯</p>
          <p>• "Ready for some practice questions to test your brain?" 🧠</p>
          <p>• "Should we connect this to other cool topics?" 🚀</p>
          <p>• "I've got more fascinating facts where that came from!" ✨</p>
        </div>
      </div>

      <References citations={citations} onJumpToMessage={onJumpToMessage} />
    </div>
  )
}
