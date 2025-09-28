const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { protect } = require('../middleware/auth');
const uploadController = require('../controllers/uploadController');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');

    // Ensure upload directory exists
    require('fs').mkdirSync(uploadDir, { recursive: true });

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// File filter to allow only PDFs and images
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/bmp'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and image files are allowed.'), false);
  }
};

// Configure multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file at a time
  }
});

// Routes

// @desc    Upload and process course form
// @route   POST /api/upload/course-form
// @access  Private
router.post('/course-form', protect, upload.single('courseForm'), uploadController.uploadCourseForm);

// @desc    Get user's courses
// @route   GET /api/upload/courses
// @access  Private
router.get('/courses', protect, uploadController.getUserCourses);

// @desc    Update course information
// @route   PUT /api/upload/courses/:courseId
// @access  Private
router.put('/courses/:courseId', protect, uploadController.updateCourse);

// @desc    Delete course
// @route   DELETE /api/upload/courses/:courseId
// @access  Private
router.delete('/courses/:courseId', protect, uploadController.deleteCourse);

// @desc    Complete onboarding
// @route   POST /api/upload/complete-onboarding
// @access  Private
router.post('/complete-onboarding', protect, uploadController.completeOnboarding);

module.exports = router;
