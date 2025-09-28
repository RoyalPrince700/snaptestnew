import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ingestService } from '../services/api';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  FileText,
  Zap,
  Database,
  Eye,
  AlertTriangle
} from 'lucide-react';

const IngestionStatus = ({ document }) => {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if ((document?._id || document?.docId) && isAuthenticated) {
      loadStatus();
      if (document.ingestionStatus === 'processing') {
        intervalRef.current = setInterval(loadStatus, 3000);
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [document?._id, document?.docId, document?.ingestionStatus, isAuthenticated]);

  const loadStatus = async () => {
    // Don't make API calls if not authenticated
    if (!isAuthenticated) {
      return;
    }

    try {
      setLoading(false); // Only show loading on first load
      const id = document?.docId || document?._id;
      const response = await ingestService.getDocumentStatus(id);
      setStatus(response.data);
      setError('');
    } catch (error) {
      console.error('Failed to load document status:', error);
      setError('Failed to load status details');
      // If we get an auth error, clear the interval to stop retrying
      if (error.response?.status === 401) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!isAuthenticated) {
      return;
    }
    
    try {
      setRefreshing(true);
      await loadStatus();
    } catch (error) {
      // Error already handled in loadStatus
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusIcon = (statusType) => {
    switch (statusType) {
      case 'processing':
        return <Clock className="h-5 w-5 text-yellow-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (statusType) => {
    switch (statusType) {
      case 'processing':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'completed':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'failed':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'pending':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading status details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <div className="flex items-center">
          <XCircle className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  const currentStatus = status || document;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            {document.originalName || document.filename}
          </h3>
          <div className="flex items-center mt-1">
            {getStatusIcon(currentStatus.ingestionStatus)}
            <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(currentStatus.ingestionStatus)}`}>
              {currentStatus.ingestionStatus?.charAt(0).toUpperCase() + currentStatus.ingestionStatus?.slice(1)}
            </span>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Document Information */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Document Information</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">File Size:</span>
            <span className="ml-2 font-medium text-gray-900">
              {currentStatus.fileSize ? formatFileSize(currentStatus.fileSize) : 'Unknown'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Upload Date:</span>
            <span className="ml-2 font-medium text-gray-900">
              {new Date(document.uploadDate).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-600">File Type:</span>
            <span className="ml-2 font-medium text-gray-900">
              {document.mimeType || 'Unknown'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Chunks Created:</span>
            <span className="ml-2 font-medium text-gray-900">
              {currentStatus.chunkCount || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Processing Progress */}
      {currentStatus.ingestionStatus === 'processing' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Clock className="h-5 w-5 text-yellow-500 mr-2 animate-spin" />
            <h4 className="text-sm font-medium text-yellow-800">Processing in Progress</h4>
          </div>
          
          {currentStatus.progress && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm text-yellow-700 mb-1">
                <span>Overall Progress</span>
                <span>{Math.round(currentStatus.progress)}%</span>
              </div>
              <div className="w-full bg-yellow-200 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${currentStatus.progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {currentStatus.currentStep && (
            <div className="text-sm text-yellow-700">
              <span className="font-medium">Current Step:</span> {currentStatus.currentStep}
            </div>
          )}
        </div>
      )}

      {/* Processing Steps */}
      {currentStatus.processingSteps && currentStatus.processingSteps.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Processing Timeline</h4>
          <div className="space-y-3">
            {currentStatus.processingSteps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className="flex-shrink-0">
                  {step.status === 'completed' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : step.status === 'processing' ? (
                    <Clock className="h-5 w-5 text-yellow-500 animate-spin" />
                  ) : step.status === 'failed' ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <div className="h-5 w-5 border-2 border-gray-300 rounded-full" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">{step.name}</p>
                  {step.description && (
                    <p className="text-xs text-gray-600">{step.description}</p>
                  )}
                  {step.timestamp && (
                    <p className="text-xs text-gray-500">
                      {new Date(step.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
                {step.duration && (
                  <div className="text-xs text-gray-500">
                    {step.duration}ms
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Details */}
      {currentStatus.ingestionStatus === 'failed' && currentStatus.errorDetails && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <XCircle className="h-5 w-5 text-red-500 mr-2" />
            <h4 className="text-sm font-medium text-red-800">Error Details</h4>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-sm font-medium text-red-700">Error Type:</span>
              <span className="ml-2 text-sm text-red-600">{currentStatus.errorDetails.type}</span>
            </div>
            <div>
              <span className="text-sm font-medium text-red-700">Message:</span>
              <p className="text-sm text-red-600 mt-1">{currentStatus.errorDetails.message}</p>
            </div>
            {currentStatus.errorDetails.stack && (
              <details className="mt-2">
                <summary className="text-sm font-medium text-red-700 cursor-pointer">
                  Technical Details
                </summary>
                <pre className="text-xs text-red-600 mt-2 p-2 bg-red-100 rounded overflow-x-auto">
                  {currentStatus.errorDetails.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Chunk Preview */}
      {currentStatus.chunkPreview && currentStatus.chunkPreview.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Chunk Preview</h4>
          <div className="space-y-3">
            {currentStatus.chunkPreview.slice(0, 3).map((chunk, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">
                    Chunk {chunk.chunkIndex + 1}
                  </span>
                  <span className="text-xs text-gray-500">
                    {chunk.content.length} characters
                  </span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-3">
                  {chunk.content.substring(0, 200)}
                  {chunk.content.length > 200 && '...'}
                </p>
                {chunk.metadata && (
                  <div className="mt-2 text-xs text-gray-500">
                    Page: {chunk.metadata.page || 'Unknown'}
                  </div>
                )}
              </div>
            ))}
            {currentStatus.chunkPreview.length > 3 && (
              <p className="text-sm text-gray-600 text-center">
                And {currentStatus.chunkPreview.length - 3} more chunks...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Embedding Status */}
      {currentStatus.embeddingStatus && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Zap className="h-5 w-5 text-blue-500 mr-2" />
            <h4 className="text-sm font-medium text-blue-800">Embedding Generation</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-blue-700 font-medium">Status:</span>
              <span className="ml-2 text-blue-600 capitalize">{currentStatus.embeddingStatus.status}</span>
            </div>
            {currentStatus.embeddingStatus.embeddingsGenerated && (
              <div>
                <span className="text-blue-700 font-medium">Embeddings Generated:</span>
                <span className="ml-2 text-blue-600">
                  {currentStatus.embeddingStatus.embeddingsGenerated} / {currentStatus.chunkCount || 0}
                </span>
              </div>
            )}
            {currentStatus.embeddingStatus.model && (
              <div>
                <span className="text-blue-700 font-medium">Model:</span>
                <span className="ml-2 text-blue-600">{currentStatus.embeddingStatus.model}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metadata */}
      {currentStatus.metadata && Object.keys(currentStatus.metadata).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Metadata</h4>
          <div className="bg-gray-50 rounded-lg p-3">
            <pre className="text-xs text-gray-700 overflow-x-auto">
              {JSON.stringify(currentStatus.metadata, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default IngestionStatus;
