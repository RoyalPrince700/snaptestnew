// MongoDB Atlas Vector Search Index Creation Script
// This script attempts to create vector search indexes for docchunks, messages, and memories collections
// NOTE: If this script fails with "Attribute mappings missing" error, use the Atlas UI instead
// See atlas_ui_instructions.md for UI-based creation steps
// Run with: mongosh "<Your_Atlas_Connection_String>" --file create_vector_indexes.js

// Switch to the snaptest database
use('snaptest');

print('Creating MongoDB Atlas Vector Search indexes...');
print('NOTE: If you encounter "Attribute mappings missing" errors, please use the Atlas UI instead.');
print('See atlas_ui_instructions.md for detailed UI instructions.');

// Create vector search index for docchunks collection
print('Creating vector index for docchunks collection...');
try {
  const docchunksResult = db.runCommand({
    createSearchIndexes: 'docchunks',
    indexes: [{
      name: 'docchunks_embedding',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: 768,
            similarity: 'cosine'
          },
          { type: 'filter', path: 'userId' },
          { type: 'filter', path: 'docId' }
        ]
      }
    }]
  });
  print('Docchunks index result:', JSON.stringify(docchunksResult, null, 2));
} catch (error) {
  print('Error creating docchunks index:', error.message);
  print('This is expected if using mongosh. Please use the Atlas UI instead.');
}

// Create vector search index for messages collection
print('Creating vector index for messages collection...');
try {
  const messagesResult = db.runCommand({
    createSearchIndexes: 'messages',
    indexes: [{
      name: 'messages_embedding',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: 768,
            similarity: 'cosine'
          },
          { type: 'filter', path: 'conversationId' }
        ]
      }
    }]
  });
  print('Messages index result:', JSON.stringify(messagesResult, null, 2));
} catch (error) {
  print('Error creating messages index:', error.message);
  print('This is expected if using mongosh. Please use the Atlas UI instead.');
}

// Create vector search index for memories collection
print('Creating vector index for memories collection...');
try {
  const memoriesResult = db.runCommand({
    createSearchIndexes: 'memories',
    indexes: [{
      name: 'memories_embedding',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: 768,
            similarity: 'cosine'
          },
          { type: 'filter', path: 'userId' }
        ]
      }
    }]
  });
  print('Memories index result:', JSON.stringify(memoriesResult, null, 2));
} catch (error) {
  print('Error creating memories index:', error.message);
  print('This is expected if using mongosh. Please use the Atlas UI instead.');
}

print('Vector search index creation completed!');

// List all search indexes to verify
print('Listing all search indexes...');
try {
  const listResult = db.runCommand({ listSearchIndexes: 'docchunks' });
  print('Docchunks indexes:', JSON.stringify(listResult, null, 2));
} catch (error) {
  print('Error listing docchunks indexes:', error.message);
}

try {
  const listResult = db.runCommand({ listSearchIndexes: 'messages' });
  print('Messages indexes:', JSON.stringify(listResult, null, 2));
} catch (error) {
  print('Error listing messages indexes:', error.message);
}

try {
  const listResult = db.runCommand({ listSearchIndexes: 'memories' });
  print('Memories indexes:', JSON.stringify(listResult, null, 2));
} catch (error) {
  print('Error listing memories indexes:', error.message);
}
