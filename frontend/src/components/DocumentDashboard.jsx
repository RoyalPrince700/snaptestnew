import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ingestService } from '../services/api';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Search, 
  Filter, 
  RefreshCw, 
  Trash2,
  Download,
  Eye
} from 'lucide-react';
import IngestionStatus from './IngestionStatus';

const DocumentDashboard = () => {
  const { isAuthenticated } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [retryingDoc, setRetryingDoc] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadDocuments();
    }
  }, [isAuthenticated]);

  const loadDocuments = async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await ingestService.getDocuments();
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryIngestion = async (docId) => {
    if (!isAuthenticated) {
      return;
    }

    try {
      setRetryingDoc(docId);
      await ingestService.retryIngestion(docId);
      // Refresh documents to show updated status
      await loadDocuments();
    } catch (error) {
      console.error('Failed to retry ingestion:', error);
      setError('Failed to retry ingestion. Please try again.');
    } finally {
      setRetryingDoc(null);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!isAuthenticated) {
      return;
    }

    try {
      await ingestService.deleteDocument(docId);
      setDocuments(documents.filter(doc => doc.docId !== docId));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete document:', error);
      setError('Failed to delete document. Please try again.');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.originalName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.ingestionStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusCounts = () => {
    return documents.reduce((acc, doc) => {
      acc[doc.ingestionStatus] = (acc[doc.ingestionStatus] || 0) + 1;
      acc.total = (acc.total || 0) + 1;
      return acc;
    }, {});
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Document Ingestion Dashboard</h2>
            <p className="text-sm text-gray-600 mt-1">
              Monitor the status of your uploaded documents and ingestion progress
            </p>
          </div>
          <button
            onClick={loadDocuments}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-gray-900">{statusCounts.total || 0}</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Completed</p>
            <p className="text-2xl font-bold text-green-900">{statusCounts.completed || 0}</p>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg">
            <p className="text-xs font-medium text-yellow-600 uppercase tracking-wide">Processing</p>
            <p className="text-2xl font-bold text-yellow-900">{statusCounts.processing || 0}</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold text-blue-900">{statusCounts.pending || 0}</p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg">
            <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Failed</p>
            <p className="text-2xl font-bold text-red-900">{statusCounts.failed || 0}</p>
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-gray-200">
          <div className="flex items-center">
            <XCircle className="h-4 w-4 text-red-500 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Documents List */}
      <div className="divide-y divide-gray-200">
        {filteredDocuments.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {documents.length === 0 ? 'No documents uploaded' : 'No documents match your filters'}
            </h3>
            <p className="text-gray-600">
              {documents.length === 0 
                ? 'Upload your first document to get started with ingestion monitoring.'
                : 'Try adjusting your search terms or filters to find documents.'
              }
            </p>
          </div>
        ) : (
          filteredDocuments.map((document) => (
            <div key={document._id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1 min-w-0">
                  <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {document.originalName || document.filename}
                    </h4>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(document.ingestionStatus)}`}>
                        {getStatusIcon(document.ingestionStatus)}
                        <span className="ml-1 capitalize">{document.ingestionStatus}</span>
                      </span>
                      <p className="text-xs text-gray-500">
                        Uploaded: {new Date(document.uploadDate).toLocaleDateString()}
                      </p>
                      {document.chunkCount && (
                        <p className="text-xs text-gray-500">
                          {document.chunkCount} chunks
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {document.ingestionStatus === 'processing' && (
                    <button
                      onClick={() => setSelectedDocument(document)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="View status details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  
                  {document.ingestionStatus === 'failed' && (
                    <button
                      onClick={() => handleRetryIngestion(document.docId)}
                      disabled={retryingDoc === document.docId}
                      className="inline-flex items-center px-2 py-1 border border-yellow-300 rounded text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {retryingDoc === document.docId ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => setShowDeleteConfirm(document.docId)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Progress bar for processing documents */}
              {document.ingestionStatus === 'processing' && document.progress && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>Processing progress</span>
                    <span>{Math.round(document.progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${document.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Ingestion Status Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Ingestion Status</h3>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <IngestionStatus document={selectedDocument} />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <XCircle className="h-6 w-6 text-red-500 mr-3" />
                <h3 className="text-lg font-medium text-gray-900">Delete Document</h3>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete this document? This will remove all associated chunks and cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleDeleteDocument(showDeleteConfirm)}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentDashboard;
