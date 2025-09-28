import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { uploadService } from '../services/api';
import { Upload, FileText, Image, X, Check, Edit, Trash2, Loader } from 'lucide-react';

const CourseUpload = ({ onComplete, onSkip }) => {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingCourse, setEditingCourse] = useState(null);
  const fileInputRef = useRef(null);

  // Load existing courses on component mount
  useEffect(() => {
    loadUserCourses();
  }, []);

  const loadUserCourses = async () => {
    try {
      setLoading(true);
      const response = await uploadService.getUserCourses();
      setCourses(response.data.courses);
    } catch (error) {
      console.error('Failed to load courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/bmp'
      ];

      if (!allowedTypes.includes(selectedFile.type)) {
        setError('Please select a PDF or image file (JPG, PNG, GIF, BMP)');
        return;
      }

      // Validate file size (10MB max)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      setFile(selectedFile);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setError('');

      const response = await uploadService.uploadCourseForm(file);

      setSuccess(`Successfully processed ${response.data.coursesFound} courses!`);
      setCourses(response.data.courses);
      setFile(null);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Upload failed:', error);
      setError(error.response?.data?.message || 'Failed to upload course form');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateCourse = async (courseId, courseData) => {
    try {
      await uploadService.updateCourse(courseId, courseData);
      setCourses(courses.map(course =>
        course._id === courseId ? { ...course, ...courseData } : course
      ));
      setEditingCourse(null);
      setSuccess('Course updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to update course:', error);
      setError('Failed to update course');
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;

    try {
      await uploadService.deleteCourse(courseId);
      setCourses(courses.filter(course => course._id !== courseId));
      setSuccess('Course deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to delete course:', error);
      setError('Failed to delete course');
    }
  };

  const handleCompleteOnboarding = async () => {
    try {
      await uploadService.completeOnboarding();
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      setError('Failed to complete onboarding');
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('image/')) return <Image className="h-8 w-8 text-blue-500" />;
    return <FileText className="h-8 w-8 text-red-500" />;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your Course Form</h2>
        <p className="text-gray-600">
          Upload your course registration form (PDF or image) and we'll automatically extract your courses
        </p>
      </div>

      {/* File Upload Section */}
      <div className="mb-8">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="course-form-upload"
          />

          {file ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-3">
                {getFileIcon(file.type)}
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 justify-center">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {uploading ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Upload & Process</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="h-12 w-12 text-gray-400 mx-auto" />
              <div>
                <label
                  htmlFor="course-form-upload"
                  className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium"
                >
                  Click to upload
                </label>
                <span className="text-gray-600"> or drag and drop</span>
                <p className="text-sm text-gray-500 mt-2">
                  PDF or image files (JPG, PNG, GIF, BMP) up to 10MB
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Courses List */}
      {courses.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Your Courses ({courses.length})
          </h3>

          <div className="space-y-3">
            {courses.map((course, index) => (
              <div key={course._id || index} className="border border-gray-200 rounded-lg p-4">
                {editingCourse === course._id ? (
                  <EditCourseForm
                    course={course}
                    onSave={(data) => handleUpdateCourse(course._id, data)}
                    onCancel={() => setEditingCourse(null)}
                  />
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {course.courseCode?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {course.courseCode} - {course.courseTitle}
                          </h4>
                          {course.credits && (
                            <p className="text-sm text-gray-600">
                              {course.credits} credits
                              {course.instructor && ` • ${course.instructor}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditingCourse(course._id)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Edit course"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course._id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete course"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <button
          onClick={onSkip}
          className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Skip for now
        </button>

        <button
          onClick={handleCompleteOnboarding}
          disabled={courses.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Check className="h-4 w-4" />
          <span>Complete Setup</span>
        </button>
      </div>
    </div>
  );
};

// Inline edit form component
const EditCourseForm = ({ course, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    courseCode: course.courseCode || '',
    courseTitle: course.courseTitle || '',
    credits: course.credits || '',
    instructor: course.instructor || '',
    semester: course.semester || '',
    schedule: course.schedule || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanedData = {
      ...formData,
      credits: formData.credits ? parseInt(formData.credits) : undefined
    };
    onSave(cleanedData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Course Code
          </label>
          <input
            type="text"
            value={formData.courseCode}
            onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Credits
          </label>
          <input
            type="number"
            value={formData.credits}
            onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0"
            max="10"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Course Title
        </label>
        <input
          type="text"
          value={formData.courseTitle}
          onChange={(e) => setFormData({ ...formData, courseTitle: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Instructor
          </label>
          <input
            type="text"
            value={formData.instructor}
            onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Semester
          </label>
          <input
            type="text"
            value={formData.semester}
            onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Fall 2024"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Schedule
        </label>
        <input
          type="text"
          value={formData.schedule}
          onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., MWF 10:00-11:00"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
};

export default CourseUpload;
