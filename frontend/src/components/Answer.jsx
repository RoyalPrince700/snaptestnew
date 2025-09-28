import React from 'react'
import ReactMarkdown from 'react-markdown'
import References from './References'
import { cleanAIResponse, cleanEmojiSequences } from '../utils/textCleaner'

export default function Answer({ data, onJumpToMessage }) {
  if (!data || typeof data !== 'object') return null
  const { answer, citations = [], uncertainty } = data

  const isUncertain = !!uncertainty?.isUncertain
  const reasons = Array.isArray(uncertainty?.reasons) ? uncertainty.reasons : []
  
  // Clean the answer text
  const cleanedAnswer = cleanEmojiSequences(cleanAIResponse(answer || ''))

  return (
    <div className="text-sm">
      {isUncertain && (
        <div className="mb-2 inline-flex items-center px-2 py-1 rounded bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">
          <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
          Possible uncertainty
          {reasons.length > 0 && (
            <span className="ml-2 text-[10px] text-yellow-700">({reasons.slice(0, 2).join('; ')}{reasons.length > 2 ? '…' : ''})</span>
          )}
        </div>
      )}

      <div className="prose prose-sm max-w-none">
        {typeof cleanedAnswer === 'string' ? <ReactMarkdown>{cleanedAnswer}</ReactMarkdown> : null}
      </div>

      <References citations={citations} onJumpToMessage={onJumpToMessage} />
    </div>
  )
}


