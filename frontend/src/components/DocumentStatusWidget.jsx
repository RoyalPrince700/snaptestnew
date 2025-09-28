import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ingestService } from '../services/api';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ChevronRight,
  Database
} from 'lucide-react';

const DocumentStatusWidget = ({ onViewDashboard }) => {
  const { isAuthenticated } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadStats();
      // Refresh stats every 30 seconds only if authenticated
      intervalRef.current = setInterval(loadStats, 30000);
    } else {
      // Clear data and stop interval if not authenticated
      setStats(null);
      setRecentDocuments([]);
      setLoading(false);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated]);

  const loadStats = async () => {
    // Don't make API calls if not authenticated
    if (!isAuthenticated) {
      return;
    }

    try {
      const [statsResponse, documentsResponse] = await Promise.all([
        ingestService.getIngestionStats(),
        ingestService.getDocuments()
      ]);
      
      setStats(statsResponse.data);
      // Get the 3 most recent documents
      const sortedDocs = (documentsResponse.data.documents || [])
        .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
        .slice(0, 3);
      setRecentDocuments(sortedDocs);
    } catch (error) {
      console.error('Failed to load document stats:', error);
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
        return 'text-yellow-700';
      case 'completed':
        return 'text-green-700';
      case 'failed':
        return 'text-red-700';
      case 'pending':
        return 'text-blue-700';
      default:
        return 'text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats || stats.totalDocuments === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center mb-3">
          <Database className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-sm font-medium text-gray-900">Document Status</h3>
        </div>
        <div className="text-center py-4">
          <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No documents uploaded yet</p>
          <p className="text-xs text-gray-400 mt-1">Upload documents to see ingestion status</p>
        </div>
      </div>
    );
  }

  const hasActiveIngestions = stats.processing > 0 || stats.pending > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Database className="h-5 w-5 text-gray-600 mr-2" />
          <h3 className="text-sm font-medium text-gray-900">Document Status</h3>
          {hasActiveIngestions && (
            <div className="ml-2 h-2 w-2 bg-yellow-400 rounded-full animate-pulse"></div>
          )}
        </div>
        <button
          onClick={onViewDashboard}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center"
        >
          View All
          <ChevronRight className="h-3 w-3 ml-1" />
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Total</span>
            <span className="text-sm font-semibold text-gray-900">{stats.totalDocuments}</span>
          </div>
        </div>
        <div className="bg-green-50 rounded p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-green-600">Ready</span>
            <span className="text-sm font-semibold text-green-900">{stats.completed}</span>
          </div>
        </div>
        {hasActiveIngestions && (
          <>
            {stats.processing > 0 && (
              <div className="bg-yellow-50 rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-yellow-600">Processing</span>
                  <span className="text-sm font-semibold text-yellow-900">{stats.processing}</span>
                </div>
              </div>
            )}
            {stats.failed > 0 && (
              <div className="bg-red-50 rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-red-600">Failed</span>
                  <span className="text-sm font-semibold text-red-900">{stats.failed}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Recent Documents */}
      {recentDocuments.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
            Recent Uploads
          </h4>
          <div className="space-y-2">
            {recentDocuments.map((doc) => (
              <div key={doc._id} className="flex items-center justify-between py-1">
                <div className="flex items-center min-w-0 flex-1">
                  <FileText className="h-3 w-3 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="text-xs text-gray-900 truncate">
                    {doc.originalName || doc.filename}
                  </span>
                </div>
                <div className="flex items-center ml-2 flex-shrink-0">
                  {getStatusIcon(doc.ingestionStatus)}
                  <span className={`text-xs ml-1 capitalize ${getStatusColor(doc.ingestionStatus)}`}>
                    {doc.ingestionStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Ingestion Notification */}
      {hasActiveIngestions && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-center">
            <Clock className="h-4 w-4 text-yellow-500 mr-2 animate-spin" />
            <span className="text-xs text-yellow-700">
              {stats.processing > 0 
                ? `${stats.processing} document${stats.processing > 1 ? 's' : ''} processing...`
                : `${stats.pending} document${stats.pending > 1 ? 's' : ''} pending...`
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentStatusWidget;
