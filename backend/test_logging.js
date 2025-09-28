/**
 * Simple test script to verify logging functionality
 * This creates test data and makes a request to test logging
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const jwt = require('jsonwebtoken');

async function createTestData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create or find test user
    let testUser = await User.findOne({ email: 'test@logging.com' });
    if (!testUser) {
      testUser = await User.create({
        username: 'testuser',
        email: 'test@logging.com',
        password: 'testpassword123',
        profile: {
          firstName: 'Test',
          lastName: 'User',
          university: 'Test University',
          year: 'Senior',
          major: 'Computer Science'
        },
        courses: [
          { courseCode: 'CS101', courseTitle: 'Introduction to Computer Science', credits: 3 },
          { courseCode: 'CS201', courseTitle: 'Data Structures', credits: 3 }
        ]
      });
      console.log('Created test user:', testUser._id);
    } else {
      console.log('Using existing test user:', testUser._id);
    }

    // Create or find test conversation
    let testConversation = await Conversation.findOne({ userId: testUser._id, title: 'Logging Test Conversation' });
    if (!testConversation) {
      testConversation = await Conversation.create({
        userId: testUser._id,
        title: 'Logging Test Conversation',
        messages: [],
        isActive: true
      });
      console.log('Created test conversation:', testConversation._id);
    } else {
      console.log('Using existing test conversation:', testConversation._id);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: testUser._id, email: testUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('\nTest data ready:');
    console.log('User ID:', testUser._id);
    console.log('Conversation ID:', testConversation._id);
    console.log('JWT Token:', token.substring(0, 50) + '...');

    console.log('\nYou can now test the ask-question endpoint with:');
    console.log(`$token = "${token}"`);
    console.log(`$body = @{ conversationId = "${testConversation._id}"; question = "What is photosynthesis?" } | ConvertTo-Json`);
    console.log(`Invoke-RestMethod -Uri http://localhost:5000/api/ai/ask-question -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $body | ConvertTo-Json -Depth 6`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error creating test data:', error);
    process.exit(1);
  }
}

createTestData();
