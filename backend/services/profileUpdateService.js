const User = require('../models/User');
const axios = require('axios');

// Service for handling AI-assisted profile updates
class ProfileUpdateService {
  constructor() {
    // We'll use internal database updates instead of API calls for better performance
    this.useInternalUpdates = true;
  }

  // Update user profile with AI-detected information
  async updateProfile(userId, updates, conversationId = null) {
    try {
      console.log('[ProfileUpdateService] Updating profile for user:', userId);

      if (!userId || !updates || typeof updates !== 'object') {
        throw new Error('Invalid parameters for profile update');
      }

      // Define allowed fields for AI updates (restrictive for security)
      const allowedFields = [
        'profile.firstName',
        'profile.lastName',
        'profile.university',
        'profile.major',
        'profile.year',
        'courses',
        'onboardingState',
        'onboardingCompleted',
        'courseFormUploaded'
      ];

      const sanitizedUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          // Special handling for name fields
          if (key === 'profile.firstName' || key === 'profile.lastName') {
            // Clean up the name - remove extra spaces, capitalize properly
            const cleanName = updates[key]
              .trim()
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
            sanitizedUpdates[key] = cleanName;
          } else if (key === 'profile.year') {
            // Map various inputs to allowed enum
            const mapping = {
              'freshman': 'Freshman',
              'sophomore': 'Sophomore',
              'junior': 'Junior',
              'senior': 'Senior',
              'graduate': 'Graduate'
            };
            const val = String(updates[key]).toLowerCase();
            sanitizedUpdates[key] = mapping[val] || updates[key];
          } else if (key === 'courses' && Array.isArray(updates[key])) {
            // Normalize course list to expected shape
            sanitizedUpdates[key] = updates[key]
              .filter(c => c && c.courseCode && c.courseTitle)
              .map(c => ({
                courseCode: String(c.courseCode).replace(/\s+/g, '').toUpperCase(),
                courseTitle: String(c.courseTitle).trim()
              }));
          } else {
            sanitizedUpdates[key] = updates[key];
          }
        }
      });

      if (Object.keys(sanitizedUpdates).length === 0) {
        return {
          success: false,
          message: 'No valid updates provided',
          updatesApplied: {}
        };
      }

      console.log('[ProfileUpdateService] Applying sanitized updates:', sanitizedUpdates);

      // If courses are included, set with $set and avoid schema overwrite issues
      const updateOp = { $set: sanitizedUpdates };

      const user = await User.findByIdAndUpdate(
        userId,
        updateOp,
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      console.log('[ProfileUpdateService] Profile updated successfully');

      return {
        success: true,
        message: 'Profile updated successfully by AI',
        updatesApplied: sanitizedUpdates,
        user: {
          id: user._id,
          profile: user.profile,
          onboardingCompleted: user.onboardingCompleted,
          onboardingState: user.onboardingState
        }
      };

    } catch (error) {
      console.error('[ProfileUpdateService] Error updating profile:', error);
      throw error;
    }
  }

  // Get current user profile context
  async getUserProfileContext(userId) {
    try {
      const user = await User.findById(userId).select('profile courses onboardingCompleted onboardingState');

      if (!user) {
        return null;
      }

      return {
        studentName: user?.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim() : null,
        university: user?.profile?.university,
        year: user?.profile?.year,
        major: user?.profile?.major,
        courses: user?.courses || [],
        hasBasicInfo: !!(user?.profile?.firstName && user?.profile?.university),
        hasCourses: !!(user?.courses && user.courses.length > 0),
        onboardingCompleted: user?.onboardingCompleted || false,
        onboardingState: user?.onboardingState || 'welcome'
      };
    } catch (error) {
      console.error('[ProfileUpdateService] Error getting user context:', error);
      return null;
    }
  }
}

module.exports = new ProfileUpdateService();
