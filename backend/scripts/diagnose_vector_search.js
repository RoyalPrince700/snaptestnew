#!/usr/bin/env node

/**
 * Vector Search Diagnostic Script
 * 
 * This script helps diagnose vector search issues by:
 * 1. Checking if vector indexes exist
 * 2. Testing basic document retrieval
 * 3. Verifying embeddings are present
 * 4. Testing vector search functionality
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const DocChunk = require('../models/DocChunk');

const VECTOR_INDEX = {
  DOCS: 'docchunks_embedding',
  MSGS: 'messages_embedding', 
  MEMS: 'memories_embedding'
};

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment variables');
    process.exit(1);
  }
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
}

async function checkIndexes() {
  console.log('\n📋 Checking Vector Search Indexes...');
  
  try {
    const db = mongoose.connection.db;
    const collections = ['docchunks', 'messages', 'memories'];
    const expectedIndexes = ['docchunks_embedding', 'messages_embedding', 'memories_embedding'];
    
    for (let i = 0; i < collections.length; i++) {
      const collection = collections[i];
      const expectedIndex = expectedIndexes[i];
      
      try {
        const indexes = await db.collection(collection).listSearchIndexes().toArray();
        const hasVectorIndex = indexes.some(idx => idx.name === expectedIndex && idx.type === 'vectorSearch');
        
        if (hasVectorIndex) {
          console.log(`✅ ${collection}: ${expectedIndex} index exists`);
        } else {
          console.log(`❌ ${collection}: ${expectedIndex} index MISSING`);
          console.log(`   Available indexes: ${indexes.map(idx => idx.name).join(', ') || 'none'}`);
        }
      } catch (error) {
        console.log(`⚠️  ${collection}: Could not check indexes - ${error.message}`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to check indexes:', error.message);
  }
}

async function checkDocuments() {
  console.log('\n📄 Checking Document Chunks...');
  
  try {
    const totalChunks = await DocChunk.countDocuments();
    console.log(`📊 Total document chunks: ${totalChunks}`);
    
    if (totalChunks === 0) {
      console.log('⚠️  No document chunks found. Upload a document first.');
      return;
    }
    
    const chunksWithEmbeddings = await DocChunk.countDocuments({ 
      embedding: { $exists: true, $ne: null, $type: 'array' } 
    });
    
    console.log(`🔢 Chunks with embeddings: ${chunksWithEmbeddings}`);
    
    if (chunksWithEmbeddings === 0) {
      console.log('❌ No chunks have embeddings! This will cause vector search to fail.');
    } else if (chunksWithEmbeddings < totalChunks) {
      console.log(`⚠️  ${totalChunks - chunksWithEmbeddings} chunks missing embeddings`);
    } else {
      console.log('✅ All chunks have embeddings');
    }
    
    // Check embedding dimensions
    const sampleChunk = await DocChunk.findOne({ embedding: { $exists: true } });
    if (sampleChunk && sampleChunk.embedding) {
      console.log(`📏 Embedding dimensions: ${sampleChunk.embedding.length}`);
      if (sampleChunk.embedding.length !== 768) {
        console.log('⚠️  Expected 768 dimensions for nomic-embed-text-v1.5');
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to check documents:', error.message);
  }
}

async function testVectorSearch() {
  console.log('\n🔍 Testing Vector Search...');
  
  try {
    // Create a sample query vector (all zeros for testing)
    const testVector = new Array(768).fill(0.1);
    
    const pipeline = [
      {
        $vectorSearch: {
          index: VECTOR_INDEX.DOCS,
          path: 'embedding',
          queryVector: testVector,
          numCandidates: 10,
          limit: 3
        }
      },
      { 
        $project: { 
          _id: 1, 
          userId: 1, 
          docId: 1, 
          text: { $substr: ['$text', 0, 100] },
          score: { $meta: 'vectorSearchScore' } 
        } 
      }
    ];
    
    console.log('🔍 Running vector search pipeline...');
    const results = await DocChunk.aggregate(pipeline).exec();
    
    if (results.length > 0) {
      console.log(`✅ Vector search working! Found ${results.length} results`);
      results.forEach((result, idx) => {
        console.log(`   [${idx}] Score: ${result.score?.toFixed(3)}, Text: ${result.text}...`);
      });
    } else {
      console.log('❌ Vector search returned no results');
      console.log('   This could mean:');
      console.log('   1. Vector index is not properly configured');
      console.log('   2. No documents have embeddings');
      console.log('   3. Vector search is not enabled on your MongoDB Atlas cluster');
    }
    
  } catch (error) {
    console.error('❌ Vector search failed:', error.message);
    
    if (error.message.includes('$vectorSearch')) {
      console.log('   This suggests the vector search index is missing or misconfigured.');
      console.log('   Please create the vector search indexes using the Atlas UI.');
      console.log('   See: backend/scripts/atlas_ui_instructions.md');
    }
  }
}

async function diagnose() {
  console.log('🔧 SnapTest Vector Search Diagnostics');
  console.log('=====================================');
  
  await connectDB();
  await checkIndexes();
  await checkDocuments();
  await testVectorSearch();
  
  console.log('\n🏁 Diagnosis Complete');
  console.log('If you see any ❌ or ⚠️ above, those are likely the cause of "I don\'t know" responses.');
  
  await mongoose.disconnect();
}

// Run diagnostics
diagnose().catch(console.error);
