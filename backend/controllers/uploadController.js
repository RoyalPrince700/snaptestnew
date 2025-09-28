const User = require('../models/User');
const ocrService = require('../services/ocrService');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ingestChunks, createDocument } = require('../services/ingest');

// File upload and OCR processing controller
class UploadController {
  // Upload and process course form
  async uploadCourseForm(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const userId = req.user.userId;
      const file = req.file;

      console.log('Processing course form upload for user:', userId);
      console.log('File details:', {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size
      });

      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/bmp'
      ];

      if (!allowedTypes.includes(file.mimetype)) {
        // Clean up uploaded file
        await ocrService.cleanupFile(file.path);
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Only PDF and image files are allowed.'
        });
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        await ocrService.cleanupFile(file.path);
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 10MB.'
        });
      }

      // Process file with OCR
      const ocrResult = await ocrService.processFile(file.path, file.mimetype);

      if (!ocrResult.success) {
        await ocrService.cleanupFile(file.path);
        return res.status(500).json({
          success: false,
          message: 'Failed to process file',
          error: ocrResult.error,
          details: ocrResult.details
        });
      }

      // Extract courses from the processed text
      const extractedCourses = ocrService.extractCourses(ocrResult.text);

      console.log('Extracted courses:', extractedCourses.length);

      // Prepare course data for database
      const coursesData = extractedCourses.map(course => ({
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        credits: course.credits,
        extractedFrom: file.originalname,
        extractedAt: new Date()
      }));

      // Update user with extracted courses
      const user = await User.findByIdAndUpdate(
        userId,
        {
          $push: { courses: { $each: coursesData } },
          courseFormUploaded: true
        },
        { new: true, runValidators: true }
      );

      if (!user) {
        await ocrService.cleanupFile(file.path);
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Clean up uploaded file
      await ocrService.cleanupFile(file.path);

      // Fire-and-forget: auto-trigger text ingestion for RAG
      try {
        const generatedDocId = uuidv4();
        const metadata = {
          filename: file.originalname,
          source: 'course-form',
          processingMethod: ocrResult.processingMethod,
          pages: ocrResult.pages,
          coursesFound: extractedCourses.length
        };

        // Create document record first
        createDocument({
          userId,
          docId: generatedDocId,
          filename: file.filename || file.originalname,
          originalName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          metadata
        })
        .then(() => {
          // Then start ingestion process
          return ingestChunks({
            userId,
            docId: generatedDocId,
            fullText: ocrResult.text,
            metadata
          });
        })
        .then(count => {
          console.log('[Auto-Ingest] Stored chunks:', count, 'docId:', generatedDocId);
        })
        .catch(err => {
          console.error('[Auto-Ingest] Failed:', err?.message || err);
        });
      } catch (ingestScheduleError) {
        console.error('[Auto-Ingest] Scheduling error:', ingestScheduleError);
      }

      res.json({
        success: true,
        message: 'Course form processed successfully',
        data: {
          extractedText: ocrResult.text,
          coursesFound: extractedCourses.length,
          courses: coursesData,
          processingMethod: ocrResult.processingMethod,
          confidence: ocrResult.confidence,
          user: {
            id: user._id,
            courseFormUploaded: user.courseFormUploaded,
            totalCourses: user.courses.length
          },
          autoIngestion: true
        }
      });

    } catch (error) {
      console.error('Upload course form error:', error);

      // Clean up file if it exists
      if (req.file && req.file.path) {
        await ocrService.cleanupFile(req.file.path);
      }

      res.status(500).json({
        success: false,
        message: 'Failed to process course form',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  // Get user's courses
  async getUserCourses(req, res) {
    try {
      const userId = req.user.userId;

      const user = await User.findById(userId).select('courses courseFormUploaded');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          courses: user.courses,
          courseFormUploaded: user.courseFormUploaded,
          totalCourses: user.courses.length
        }
      });

    } catch (error) {
      console.error('Get user courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get courses',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  // Update course information
  async updateCourse(req, res) {
    try {
      const userId = req.user.userId;
      const { courseId } = req.params;
      const updateData = req.body;

      // Validate update data
      const allowedFields = ['courseCode', 'courseTitle', 'credits', 'instructor', 'semester', 'schedule'];
      const filteredData = {};

      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredData[key] = updateData[key];
        }
      });

      if (Object.keys(filteredData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields to update'
        });
      }

      const user = await User.findOneAndUpdate(
        { _id: userId, 'courses._id': courseId },
        { $set: { 'courses.$': { ...filteredData, _id: courseId } } },
        { new: true, runValidators: true }
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      res.json({
        success: true,
        message: 'Course updated successfully',
        data: {
          course: user.courses.find(c => c._id.toString() === courseId)
        }
      });

    } catch (error) {
      console.error('Update course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update course',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  // Delete course
  async deleteCourse(req, res) {
    try {
      const userId = req.user.userId;
      const { courseId } = req.params;

      const user = await User.findByIdAndUpdate(
        userId,
        { $pull: { courses: { _id: courseId } } },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'Course deleted successfully',
        data: {
          totalCourses: user.courses.length
        }
      });

    } catch (error) {
      console.error('Delete course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete course',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }

  // Complete onboarding
  async completeOnboarding(req, res) {
    try {
      const userId = req.user.userId;

      const user = await User.findByIdAndUpdate(
        userId,
        { onboardingCompleted: true },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'Onboarding completed successfully',
        data: {
          onboardingCompleted: user.onboardingCompleted
        }
      });

    } catch (error) {
      console.error('Complete onboarding error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete onboarding',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }
  }
}

module.exports = new UploadController();
