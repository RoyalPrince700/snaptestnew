import { useEffect, useMemo, useState } from 'react'
import { memoryService } from '../services/api'
import { Search, Plus, Edit2, Trash2, BarChart2, RefreshCw } from 'lucide-react'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'profile', label: 'Profile' },
  { key: 'fact', label: 'Facts' },
  { key: 'preference', label: 'Preferences' }
]

function MemoryRow({ memory, onEdit, onDelete }) {
  return (
    <div className="grid grid-cols-12 gap-3 items-center py-3 border-b border-gray-100">
      <div className="col-span-7">
        <p className="text-sm text-gray-900 line-clamp-2">{memory.content}</p>
        <p className="text-xs text-gray-500 mt-1">
          {memory.kind} • {new Date(memory.updatedAt || memory.createdAt).toLocaleString()}
        </p>
      </div>
      <div className="col-span-3 text-xs text-gray-600">
        <div>Uses: {memory.usageCount ?? '-'}</div>
        <div>Score: {typeof memory.score === 'number' ? memory.score.toFixed(2) : '-'}</div>
      </div>
      <div className="col-span-2 flex justify-end space-x-2">
        <button onClick={() => onEdit(memory)} className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded">
          <Edit2 className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(memory)} className="px-2 py-1 text-red-600 hover:bg-red-50 rounded">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default function MemoryManager() {
  const [activeTab, setActiveTab] = useState('all')
  const [query, setQuery] = useState('')
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState(null)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ content: '', kind: 'fact' })
  const [saving, setSaving] = useState(false)

  const loadStats = async () => {
    try {
      const data = await memoryService.getMemoryStats()
      setStats(data?.data || data)
    } catch (e) {
      // optional stats
    }
  }

  const loadMemories = async () => {
    setLoading(true)
    setError('')
    try {
      const kind = activeTab === 'all' ? undefined : activeTab
      const data = await memoryService.getMemories(kind, query.trim() || undefined)
      setMemories(data?.data || data || [])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load memories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStats() }, [])
  useEffect(() => { loadMemories() }, [activeTab])

  const filtered = useMemo(() => memories, [memories])

  const openCreate = () => {
    setEditing(null)
    setForm({ content: '', kind: 'fact' })
    setEditorOpen(true)
  }

  const openEdit = (m) => {
    setEditing(m)
    setForm({ content: m.content || '', kind: m.kind || 'fact' })
    setEditorOpen(true)
  }

  const saveMemory = async (e) => {
    e?.preventDefault?.()
    if (!form.content.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await memoryService.updateMemory(editing._id || editing.id, form.content.trim(), form.kind)
      } else {
        await memoryService.createMemory(form.content.trim(), form.kind)
      }
      setEditorOpen(false)
      setEditing(null)
      setForm({ content: '', kind: 'fact' })
      await Promise.all([loadMemories(), loadStats()])
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to save memory')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async (m) => {
    if (!confirm('Delete this memory?')) return
    try {
      await memoryService.deleteMemory(m._id || m.id)
      await Promise.all([loadMemories(), loadStats()])
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to delete memory')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Memories</h2>
          <p className="text-sm text-gray-600">Manage profile facts and preferences.</p>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={openCreate} className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-1" /> New Memory
          </button>
          <button onClick={() => { setQuery(''); loadMemories() }} className="p-2 text-gray-600 hover:bg-gray-100 rounded">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 bg-white border border-gray-200 rounded-md">
            <div className="text-xs text-gray-500">Total Memories</div>
            <div className="text-lg font-semibold">{stats.total ?? '-'}</div>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-md">
            <div className="text-xs text-gray-500">By Kind</div>
            <div className="text-sm text-gray-700">{Object.entries(stats.byKind || {}).map(([k, v]) => `${k}: ${v}`).join('  •  ') || '-'}</div>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-md">
            <div className="text-xs text-gray-500">Last Updated</div>
            <div className="text-sm text-gray-700">{stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : '-'}</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-md">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 text-sm rounded-md ${activeTab === t.key ? 'bg-white shadow border border-gray-200' : 'text-gray-600'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') loadMemories() }}
            placeholder="Search memories..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-md">
        {loading ? (
          <div className="p-6 text-center text-gray-600">Loading memories...</div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-gray-600">No memories found.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((m) => (
              <MemoryRow key={m._id || m.id} memory={m} onEdit={openEdit} onDelete={confirmDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">{editing ? 'Edit Memory' : 'New Memory'}</h3>
              <button onClick={() => setEditorOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={saveMemory} className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Kind</label>
                <select
                  value={form.kind}
                  onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="profile">Profile</option>
                  <option value="fact">Fact</option>
                  <option value="preference">Preference</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={5}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter the memory content..."
                />
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button type="button" onClick={() => setEditorOpen(false)} className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700">Cancel</button>
                <button type="submit" disabled={saving} className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


