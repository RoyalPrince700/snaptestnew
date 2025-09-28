const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profile: {
    firstName: String,
    lastName: String,
    avatar: String,
    bio: String,
    university: String,
    major: String,
    year: {
      type: String,
      enum: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']
    }
  },
  courses: [{
    courseCode: {
      type: String,
      required: true,
      trim: true
    },
    courseTitle: {
      type: String,
      required: true,
      trim: true
    },
    credits: {
      type: Number,
      min: 0,
      max: 10
    },
    instructor: String,
    semester: String,
    schedule: String,
    extractedFrom: String,
    extractedAt: {
      type: Date,
      default: Date.now
    }
  }],
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  courseFormUploaded: {
    type: Boolean,
    default: false
  },
  onboardingState: {
    type: String,
    enum: ['welcome', 'name', 'university', 'courses', 'complete'],
    default: 'welcome'
  },
  studyStats: {
    totalStudyTime: { type: Number, default: 0 }, // in minutes
    sessionsCompleted: { type: Number, default: 0 },
    subjectsStudied: [{ type: String }],
    averageScore: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0 }
  },
  preferences: {
    studyReminders: { type: Boolean, default: true },
    darkMode: { type: Boolean, default: false },
    notificationSettings: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
