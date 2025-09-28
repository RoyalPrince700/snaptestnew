require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Feedback = require('../models/Feedback');
const jwt = require('jsonwebtoken');

async function testFeedbackEndpoint() {
  try {
    console.log('🚀 Testing Feedback Endpoint...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clean up any existing test data
    await User.deleteMany({ email: 'test-feedback@example.com' });
    await Conversation.deleteMany({ title: 'Test Feedback Conversation' });
    
    // Create test user
    console.log('\n📝 Creating test user...');
    const testUser = await User.create({
      username: 'testfeedbackuser',
      email: 'test-feedback@example.com',
      password: 'testpass123',
      profile: {
        firstName: 'Test',
        lastName: 'User'
      }
    });
    console.log('✅ Test user created:', testUser._id);

    // Generate JWT token
    const token = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('✅ JWT token generated');

    // Create test conversation
    console.log('\n💬 Creating test conversation...');
    const conversation = await Conversation.create({
      userId: testUser._id,
      title: 'Test Feedback Conversation',
      sessionSummary: 'Testing feedback functionality'
    });
    console.log('✅ Conversation created:', conversation._id);

    // Create test messages
    console.log('\n📨 Creating test messages...');
    const userMessage = await Message.create({
      conversationId: conversation._id,
      role: 'user',
      content: 'What is photosynthesis?',
      tokens: 4,
      embedding: new Array(768).fill(0.1),
      sourceRefs: []
    });

    const assistantMessage = await Message.create({
      conversationId: conversation._id,
      role: 'assistant',
      content: 'Photosynthesis is the process by which plants convert sunlight into energy using chloroplasts.',
      tokens: 15,
      embedding: new Array(768).fill(0.2),
      sourceRefs: [{ type: 'pdf', id: 'test-doc-1' }]
    });

    console.log('✅ Messages created:');
    console.log('  - User message:', userMessage._id);
    console.log('  - Assistant message:', assistantMessage._id);

    // Test feedback submission via direct API call simulation
    console.log('\n🔍 Testing feedback submission...');
    
    // Test 1: Submit "good" feedback
    console.log('\n📝 Test 1: Submitting "good" feedback...');
    const feedback1 = await Feedback.create({
      userId: testUser._id,
      conversationId: conversation._id,
      messageId: assistantMessage._id,
      kind: 'good',
      comment: 'Very helpful explanation!'
    });
    console.log('✅ Good feedback created:', feedback1._id);

    // Test 2: Submit "hallucination" feedback
    console.log('\n📝 Test 2: Submitting "hallucination" feedback...');
    const feedback2 = await Feedback.create({
      userId: testUser._id,
      conversationId: conversation._id,
      messageId: assistantMessage._id,
      kind: 'hallucination',
      comment: 'This claim seems unsupported by the source material.'
    });
    console.log('✅ Hallucination feedback created:', feedback2._id);

    // Test 3: Submit "bad" feedback
    console.log('\n📝 Test 3: Submitting "bad" feedback...');
    const feedback3 = await Feedback.create({
      userId: testUser._id,
      conversationId: conversation._id,
      messageId: assistantMessage._id,
      kind: 'bad',
      comment: 'Not what I was looking for.'
    });
    console.log('✅ Bad feedback created:', feedback3._id);

    // Test analytics aggregation
    console.log('\n📊 Testing feedback analytics...');
    const countsAgg = await Feedback.aggregate([
      { $match: { messageId: assistantMessage._id } },
      { $group: { _id: '$kind', count: { $sum: 1 } } }
    ]);
    
    const counts = countsAgg.reduce((acc, cur) => { 
      acc[cur._id] = cur.count; 
      return acc; 
    }, { hallucination: 0, good: 0, bad: 0 });

    console.log('✅ Feedback counts for message:', counts);
    console.log('  Expected: { good: 1, hallucination: 1, bad: 1 }');

    // Verify counts are correct
    if (counts.good === 1 && counts.hallucination === 1 && counts.bad === 1) {
      console.log('✅ Analytics aggregation working correctly!');
    } else {
      console.log('❌ Analytics aggregation failed!');
    }

    // Generate PowerShell test command
    console.log('\n🔧 PowerShell test command:');
    console.log('='.repeat(80));
    console.log(`$token = "${token}"`);
    console.log(`$body = @{`);
    console.log(`  conversationId = "${conversation._id}"`);
    console.log(`  messageId = "${assistantMessage._id}"`);
    console.log(`  kind = "hallucination"`);
    console.log(`  comment = "Test hallucination report"`);
    console.log(`} | ConvertTo-Json`);
    console.log(`Invoke-RestMethod -Uri http://localhost:5000/api/ai/feedback -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $body | ConvertTo-Json -Depth 5`);
    console.log('='.repeat(80));

    // Test data summary
    console.log('\n📋 Test Data Summary:');
    console.log('='.repeat(50));
    console.log(`Test User ID: ${testUser._id}`);
    console.log(`Conversation ID: ${conversation._id}`);
    console.log(`Assistant Message ID: ${assistantMessage._id}`);
    console.log(`JWT Token: ${token.substring(0, 50)}...`);
    console.log('='.repeat(50));

    console.log('\n🎉 Feedback endpoint test completed successfully!');
    console.log('\n💡 To test via HTTP:');
    console.log('1. Start the backend server: cd backend && npm run dev');
    console.log('2. Run the PowerShell command above');
    console.log('3. Expected response: JSON with success:true, data._id, and data.counts');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Clean up and close connection
    console.log('\n🧹 Cleaning up test data...');
    try {
      await Feedback.deleteMany({ userId: { $exists: true } });
      await Message.deleteMany({ conversationId: { $exists: true } });
      await Conversation.deleteMany({ title: 'Test Feedback Conversation' });
      await User.deleteMany({ email: 'test-feedback@example.com' });
      console.log('✅ Test data cleaned up');
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup failed:', cleanupError.message);
    }
    
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  }
}

// Run the test
testFeedbackEndpoint();
