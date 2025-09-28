import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import DocumentDashboard from '../components/DocumentDashboard'

const Documents = () => {
  const navigate = useNavigate()

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-medium text-gray-900">Document Dashboard</h1>
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          aria-label="Close documents"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-4 overflow-y-auto">
        <DocumentDashboard />
      </div>
    </div>
  )
}

export default Documents


