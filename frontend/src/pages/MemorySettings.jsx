import MemoryManager from '../components/MemoryManager'
import { useEffect, useState } from 'react'
import { memoryService } from '../services/api'
import { Download, Upload, Trash2, ShieldCheck, RefreshCw } from 'lucide-react'

export default function MemorySettings() {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [syncStatus, setSyncStatus] = useState('Idle')

  const doExport = async () => {
    try {
      setExporting(true)
      const res = await memoryService.getMemories()
      const blob = new Blob([JSON.stringify(res?.data || res || [], null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'memories-export.json'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const doImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const items = JSON.parse(text)
      if (Array.isArray(items)) {
        for (const it of items) {
          if (it && it.content && it.kind) {
            // Best-effort import
            await memoryService.createMemory(it.content, it.kind)
          }
        }
      }
      alert('Import complete')
    } catch (err) {
      alert('Failed to import file')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const clearByType = async (kind) => {
    if (!confirm(`Clear all ${kind} memories?`)) return
    setClearing(true)
    try {
      const all = await memoryService.getMemories(kind)
      const list = all?.data || all || []
      for (const m of list) {
        await memoryService.deleteMemory(m._id || m.id)
      }
      alert('Cleared')
    } catch (err) {
      alert('Failed to clear')
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    setSyncStatus('Idle')
  }, [])

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Memory Settings</h1>
          <p className="text-sm text-gray-600">View, edit, import/export, and privacy controls.</p>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={doExport} disabled={exporting} className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50">
            <Download className="w-4 h-4 mr-2" /> {exporting ? 'Exporting...' : 'Export'}
          </button>
          <label className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50 cursor-pointer">
            <Upload className="w-4 h-4 mr-2" /> {importing ? 'Importing...' : 'Import'}
            <input type="file" accept="application/json" className="hidden" onChange={doImport} />
          </label>
        </div>
      </div>

      {/* Sync & Privacy */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 bg-white border border-gray-200 rounded-md">
          <div className="text-xs text-gray-500">Embedding Sync</div>
          <div className="flex items-center justify-between mt-1">
            <div className="text-sm text-gray-800">Status: {syncStatus}</div>
            <button className="px-2 py-1 text-xs rounded-md bg-blue-600 text-white inline-flex items-center">
              <RefreshCw className="w-3 h-3 mr-1" /> Sync Now
            </button>
          </div>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-md">
          <div className="text-xs text-gray-500">Privacy</div>
          <div className="mt-1 text-sm text-gray-800 inline-flex items-center">
            <ShieldCheck className="w-4 h-4 text-green-600 mr-2" />
            Memories are private to your account.
          </div>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-md">
          <div className="text-xs text-gray-500">Bulk Actions</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {['profile', 'fact', 'preference'].map(k => (
              <button key={k} onClick={() => clearByType(k)} disabled={clearing} className="px-3 py-1.5 text-xs rounded-md bg-red-50 text-red-700 border border-red-200 inline-flex items-center">
                <Trash2 className="w-3 h-3 mr-1" /> Clear {k}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-4">
        <MemoryManager />
      </div>
    </div>
  )
}


