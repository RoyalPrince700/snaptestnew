import React from 'react'

const typeLabelMap = {
  pdf: { label: 'PDF', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  chat: { label: 'Chat', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  profile: { label: 'Profile', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' }
}

function truncateId(id) {
  if (!id || typeof id !== 'string') return ''
  if (id.length <= 10) return id
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

export default function References({ citations = [], onJumpToMessage }) {
  if (!Array.isArray(citations) || citations.length === 0) {
    return null
  }

  return (
    <div className="mt-3 border-t border-gray-200 pt-3">
      <h4 className="text-xs font-semibold text-gray-600 tracking-wide uppercase mb-2">References</h4>
      <ul className="space-y-2">
        {citations.map((c, idx) => {
          const meta = typeLabelMap[c?.type] || { label: String(c?.type || 'ref'), color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' }
          const showJump = c?.type === 'chat' && typeof onJumpToMessage === 'function'
          return (
            <li key={`${c?.id || 'ref'}-${idx}`} className="p-2 rounded-md bg-gray-50 border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded ${meta.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1 ${meta.dot}`}></span>
                    {meta.label}
                  </span>
                  <span className="text-xs text-gray-500 select-all">{truncateId(c?.id)}</span>
                  {typeof c?.page === 'number' && (
                    <span className="text-[10px] text-gray-400">p.{c.page}</span>
                  )}
                </div>
                {showJump ? (
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-700"
                    onClick={() => onJumpToMessage(c.id)}
                    title="Jump to cited message"
                  >
                    Jump
                  </button>
                ) : null}
              </div>
              {c?.quote ? (
                <p className="mt-1 text-xs text-gray-700 italic border-l-2 border-gray-300 pl-2">{c.quote}</p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}


