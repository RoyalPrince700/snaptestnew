const fs = require('fs-extra');
const path = require('path');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');

// OCR Service for processing course forms
class OCRService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../uploads');
    this.ensureUploadDir();
  }

  // Ensure upload directory exists
  async ensureUploadDir() {
    try {
      await fs.ensureDir(this.uploadDir);
    } catch (error) {
      console.error('Failed to create upload directory:', error);
    }
  }

  // Extract text from PDF files
  async extractTextFromPDF(filePath) {
    try {
      console.log('Processing PDF file:', filePath);
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);

      console.log('PDF text extracted successfully, length:', data.text.length);
      return {
        success: true,
        text: data.text,
        pages: data.numpages,
        info: data.info
      };
    } catch (error) {
      console.error('PDF processing error:', error);
      return {
        success: false,
        error: 'Failed to process PDF file',
        details: error.message
      };
    }
  }

  // Extract text from image files using OCR
  async extractTextFromImage(filePath) {
    let worker;
    try {
      console.log('Processing image file with OCR:', filePath);

      // Initialize Tesseract worker
      worker = await createWorker();

      // Load English language
      await worker.loadLanguage('eng');
      await worker.initialize('eng');

      // Set parameters for better accuracy with course forms
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 :.-()/',
        tessedit_pageseg_mode: '6', // Uniform block of text
      });

      // Preprocess image for better OCR results
      const processedImagePath = await this.preprocessImage(filePath);

      // Perform OCR
      const { data: { text, confidence } } = await worker.recognize(processedImagePath);

      // Clean up processed image
      if (processedImagePath !== filePath) {
        await fs.remove(processedImagePath);
      }

      console.log('OCR completed successfully, confidence:', confidence);

      return {
        success: true,
        text: text,
        confidence: confidence
      };
    } catch (error) {
      console.error('OCR processing error:', error);
      return {
        success: false,
        error: 'Failed to process image with OCR',
        details: error.message
      };
    } finally {
      // Clean up worker
      if (worker) {
        await worker.terminate();
      }
    }
  }

  // Preprocess image for better OCR results
  async preprocessImage(inputPath) {
    try {
      const outputPath = inputPath.replace(path.extname(inputPath), '_processed.png');

      await sharp(inputPath)
        .resize(null, 2000, { // Scale up for better OCR
          withoutEnlargement: true
        })
        .sharpen() // Sharpen the image
        .normalise() // Normalize contrast
        .toFormat('png')
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.log('Image preprocessing failed, using original:', error.message);
      return inputPath; // Return original if preprocessing fails
    }
  }

  // Process any file type (PDF or image)
  async processFile(filePath, mimeType) {
    try {
      console.log('Processing file:', filePath, 'Type:', mimeType);

      let result;

      if (mimeType === 'application/pdf') {
        result = await this.extractTextFromPDF(filePath);
      } else if (mimeType.startsWith('image/')) {
        result = await this.extractTextFromImage(filePath);
      } else {
        return {
          success: false,
          error: 'Unsupported file type. Only PDF and image files are supported.'
        };
      }

      if (!result.success) {
        return result;
      }

      // Clean and normalize the extracted text
      const cleanedText = this.cleanExtractedText(result.text);

      return {
        success: true,
        text: cleanedText,
        originalText: result.text,
        confidence: result.confidence,
        pages: result.pages,
        processingMethod: mimeType === 'application/pdf' ? 'pdf-parse' : 'tesseract-ocr'
      };

    } catch (error) {
      console.error('File processing error:', error);
      return {
        success: false,
        error: 'Failed to process file',
        details: error.message
      };
    }
  }

  // Clean and normalize extracted text
  cleanExtractedText(text) {
    return text
      .replace(/\n+/g, ' ') // Replace multiple newlines with single space
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s:.\-\(\)\/]/g, '') // Remove special characters except common ones
      .trim();
  }

  // Extract course information from text using regex patterns
  extractCourses(text) {
    const courses = [];

    // Common course code patterns
    const courseCodePatterns = [
      /\b([A-Z]{2,4})\s*(\d{3,4}[A-Z]?)\b/g, // CS101, MATH201A
      /\b([A-Z]{2,4})(\d{3,4}[A-Z]?)\b/g, // CS101, MATH201A
      /\b([A-Z]{2,4})\s*-?\s*(\d{3,4}[A-Z]?)\b/g // CS-101, MATH 201A
    ];

    // Find course codes and extract surrounding context for titles
    const lines = text.split(/[.!?]+/).map(line => line.trim()).filter(line => line.length > 0);

    for (const line of lines) {
      let courseCode = null;
      let courseTitle = null;

      // Try to match course codes
      for (const pattern of courseCodePatterns) {
        const match = pattern.exec(line);
        if (match) {
          courseCode = match[1] + match[2];
          break;
        }
      }

      if (courseCode) {
        // Extract title from the same line or next few lines
        const titleMatch = line.match(/:\s*(.+?)(?:\s*\(\d+\s*credits?\)|$)/i);
        if (titleMatch) {
          courseTitle = titleMatch[1].trim();
        } else {
          // Look for title after course code
          const afterCode = line.split(courseCode)[1];
          if (afterCode) {
            courseTitle = afterCode.replace(/^[\s:-]+/, '').split(/\s*\(\d+/)[0].trim();
          }
        }

        // Extract credits if available
        const creditMatch = line.match(/\(?(\d+)\s*credits?\)?/i);
        const credits = creditMatch ? parseInt(creditMatch[1]) : null;

        if (courseTitle && courseTitle.length > 3) {
          courses.push({
            courseCode: courseCode.toUpperCase(),
            courseTitle: courseTitle,
            credits: credits,
            rawLine: line
          });
        }
      }
    }

    return courses;
  }

  // Clean up uploaded files
  async cleanupFile(filePath) {
    try {
      await fs.remove(filePath);
      console.log('Cleaned up file:', filePath);
    } catch (error) {
      console.error('Failed to cleanup file:', filePath, error);
    }
  }
}

module.exports = new OCRService();
