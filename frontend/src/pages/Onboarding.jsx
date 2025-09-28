import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CourseUpload from '../components/CourseUpload';
import { CheckCircle, User, BookOpen, Sparkles } from 'lucide-react';

const Onboarding = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [profileData, setProfileData] = useState({
    firstName: user?.profile?.firstName || '',
    lastName: user?.profile?.lastName || '',
    university: user?.profile?.university || '',
    year: user?.profile?.year || '',
    major: user?.profile?.major || ''
  });

  const steps = [
    { id: 'profile', title: 'Personal Info', icon: User },
    { id: 'courses', title: 'Course Upload', icon: BookOpen },
    { id: 'complete', title: 'All Set!', icon: CheckCircle }
  ];

  const handleProfileSubmit = async (e) => {
    e.preventDefault();

    try {
      const result = await updateProfile({
        'profile.firstName': profileData.firstName,
        'profile.lastName': profileData.lastName,
        'profile.university': profileData.university,
        'profile.year': profileData.year,
        'profile.major': profileData.major
      });

      if (result.success) {
        setCurrentStep(1);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleCourseUploadComplete = () => {
    setCurrentStep(2);
  };

  const handleSkipCourses = () => {
    setCurrentStep(2);
  };

  const handleFinish = () => {
    navigate('/'); // Navigate to main app
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              isCompleted
                ? 'bg-green-500 text-white'
                : isActive
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-300 text-gray-600'
            }`}>
              {isCompleted ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <Icon className="w-5 h-5" />
              )}
            </div>

            <span className={`ml-2 text-sm font-medium ${
              isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
            }`}>
              {step.title}
            </span>

            {index < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-4 ${
                isCompleted ? 'bg-green-500' : 'bg-gray-300'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderProfileStep = () => (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <User className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tell us about yourself</h2>
        <p className="text-gray-600">
          This helps us personalize your learning experience
        </p>
      </div>

      <form onSubmit={handleProfileSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name
            </label>
            <input
              type="text"
              value={profileData.firstName}
              onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name
            </label>
            <input
              type="text"
              value={profileData.lastName}
              onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            University
          </label>
          <input
            type="text"
            value={profileData.university}
            onChange={(e) => setProfileData({ ...profileData, university: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., University of Example"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Academic Year
          </label>
          <select
            value={profileData.year}
            onChange={(e) => setProfileData({ ...profileData, year: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select your year</option>
            <option value="Freshman">Freshman</option>
            <option value="Sophomore">Sophomore</option>
            <option value="Junior">Junior</option>
            <option value="Senior">Senior</option>
            <option value="Graduate">Graduate</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Major/Field of Study
          </label>
          <input
            type="text"
            value={profileData.major}
            onChange={(e) => setProfileData({ ...profileData, major: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Computer Science"
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Continue to Course Upload
        </button>
      </form>
    </div>
  );

  const renderCompletionStep = () => (
    <div className="max-w-md mx-auto text-center">
      <div className="mb-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">You're all set!</h2>
        <p className="text-gray-600 mb-6">
          Your profile has been configured and your courses are ready.
          You can now start chatting with our AI tutor for personalized learning assistance.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
        <ul className="text-left text-blue-800 space-y-2">
          <li>• AI responses will be personalized to your courses</li>
          <li>• Get help with specific course topics</li>
          <li>• Receive study recommendations based on your subjects</li>
          <li>• Track your learning progress across all courses</li>
        </ul>
      </div>

      <button
        onClick={handleFinish}
        className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center space-x-2"
      >
        <CheckCircle className="w-5 h-5" />
        <span>Start Learning!</span>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {renderStepIndicator()}

        <div className="bg-white rounded-lg shadow-lg p-8">
          {currentStep === 0 && renderProfileStep()}
          {currentStep === 1 && (
            <CourseUpload
              onComplete={handleCourseUploadComplete}
              onSkip={handleSkipCourses}
            />
          )}
          {currentStep === 2 && renderCompletionStep()}
        </div>

        {/* Skip option for profile step */}
        {currentStep === 0 && (
          <div className="text-center mt-6">
            <button
              onClick={() => setCurrentStep(1)}
              className="text-gray-500 hover:text-gray-700 transition-colors text-sm"
            >
              Skip profile setup →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
