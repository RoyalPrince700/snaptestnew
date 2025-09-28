// Test script to verify vector search indexes are working
// This script tests vector search functionality on all three collections
// Run with: mongosh "<Your_Atlas_Connection_String>" --file test_vector_search.js

// Switch to the snaptest database
use('snaptest');

print('Testing MongoDB Atlas Vector Search indexes...');

// Test vector search on docchunks collection
print('Testing docchunks vector search...');
try {
  // Create a test embedding (768 dimensions of zeros for testing)
  const testEmbedding = new Array(768).fill(0.1);
  
  const docchunksResult = db.docchunks.aggregate([
    {
      $vectorSearch: {
        index: 'docchunks_embedding',
        path: 'embedding',
        queryVector: testEmbedding,
        numCandidates: 10,
        limit: 5
      }
    }
  ]).toArray();
  
  print(`Found ${docchunksResult.length} docchunks with vector search`);
} catch (error) {
  print('Error testing docchunks vector search:', error.message);
}

// Test vector search on messages collection
print('Testing messages vector search...');
try {
  const testEmbedding = new Array(768).fill(0.1);
  
  const messagesResult = db.messages.aggregate([
    {
      $vectorSearch: {
        index: 'messages_embedding',
        path: 'embedding',
        queryVector: testEmbedding,
        numCandidates: 10,
        limit: 5
      }
    }
  ]).toArray();
  
  print(`Found ${messagesResult.length} messages with vector search`);
} catch (error) {
  print('Error testing messages vector search:', error.message);
}

// Test vector search on memories collection
print('Testing memories vector search...');
try {
  const testEmbedding = new Array(768).fill(0.1);
  
  const memoriesResult = db.memories.aggregate([
    {
      $vectorSearch: {
        index: 'memories_embedding',
        path: 'embedding',
        queryVector: testEmbedding,
        numCandidates: 10,
        limit: 5
      }
    }
  ]).toArray();
  
  print(`Found ${memoriesResult.length} memories with vector search`);
} catch (error) {
  print('Error testing memories vector search:', error.message);
}

print('Vector search testing completed!');

// List collection counts
print('Collection document counts:');
print(`- docchunks: ${db.docchunks.countDocuments()}`);
print(`- messages: ${db.messages.countDocuments()}`);
print(`- memories: ${db.memories.countDocuments()}`);
