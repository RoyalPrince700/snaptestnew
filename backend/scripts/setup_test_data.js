// Setup script to create test data for vector search indexes
// This script creates sample documents with embeddings for testing

// Switch to the snaptest database
use('snaptest');

print('Setting up test data for vector search...');

// Create a sample embedding (768 dimensions)
const sampleEmbedding = new Array(768).fill(0.1);

// Create sample docchunks
print('Creating sample docchunks...');
db.docchunks.insertMany([
  {
    userId: ObjectId(),
    docId: 'test-doc-1',
    page: 1,
    text: 'This is a test document about photosynthesis. Plants use sunlight to convert carbon dioxide and water into glucose.',
    embedding: sampleEmbedding,
    metadata: { filename: 'test.pdf', course: 'Biology 101' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    userId: ObjectId(),
    docId: 'test-doc-2',
    page: 2,
    text: 'Chloroplasts are the organelles responsible for photosynthesis in plant cells.',
    embedding: sampleEmbedding,
    metadata: { filename: 'test.pdf', course: 'Biology 101' },
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Create sample messages
print('Creating sample messages...');
const conversationId = ObjectId();
db.messages.insertMany([
  {
    conversationId: conversationId,
    role: 'user',
    content: 'What is photosynthesis?',
    tokens: 4,
    embedding: sampleEmbedding,
    sourceRefs: [],
    createdAt: new Date()
  },
  {
    conversationId: conversationId,
    role: 'assistant',
    content: 'Photosynthesis is the process by which plants convert sunlight into energy.',
    tokens: 15,
    embedding: sampleEmbedding,
    sourceRefs: [{ type: 'pdf', id: 'test-doc-1', page: 1 }],
    createdAt: new Date()
  }
]);

// Create sample memories
print('Creating sample memories...');
const userId = ObjectId();
db.memories.insertMany([
  {
    userId: userId,
    kind: 'profile',
    content: 'User is interested in biology and plant science',
    embedding: sampleEmbedding,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    userId: userId,
    kind: 'fact',
    content: 'Photosynthesis occurs in chloroplasts',
    embedding: sampleEmbedding,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

print('Test data setup completed!');
print('Collection counts:');
print(`- docchunks: ${db.docchunks.countDocuments()}`);
print(`- messages: ${db.messages.countDocuments()}`);
print(`- memories: ${db.memories.countDocuments()}`);
