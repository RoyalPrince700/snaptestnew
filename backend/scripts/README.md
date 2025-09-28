# MongoDB Atlas Vector Search Scripts

This directory contains scripts for creating and testing MongoDB Atlas Vector Search indexes for the StudyAI application.

## Prerequisites

1. **MongoDB Shell (mongosh)**: Install from [MongoDB Shell Download](https://www.mongodb.com/try/download/shell)
2. **MongoDB Atlas Connection**: Ensure `MONGODB_URI` is set in your `.env` file
3. **Database**: The scripts assume you're using the `snaptest` database

## Scripts

### 1. Create Vector Indexes

**Files:**
- `create_vector_indexes.js` - MongoDB shell script (may fail with mongosh)
- `create_vector_indexes.ps1` - PowerShell wrapper script
- `atlas_ui_instructions.md` - **RECOMMENDED** UI-based instructions

**Purpose:** Creates vector search indexes on the following collections:
- `docchunks` → `docchunks_embedding` index
- `messages` → `messages_embedding` index  
- `memories` → `memories_embedding` index

**Configuration:**
- Vector dimensions: 768 (for nomic-ai/nomic-embed-text-v1.5)
- Similarity: cosine
- Field: `embedding`

**⚠️ Important Note:**
The mongosh scripts may fail with "Attribute mappings missing" errors. This is a known limitation with certain MongoDB Atlas versions. **Use the Atlas UI instead** (see `atlas_ui_instructions.md`).

**Usage:**
```powershell
# PowerShell (will show expected errors, then guide you to UI)
cd backend/scripts
.\create_vector_indexes.ps1

# Or directly with mongosh (may fail)
mongosh "<Your_Atlas_Connection_String>" --file create_vector_indexes.js
```

**Recommended Approach:**
1. Follow the step-by-step instructions in `atlas_ui_instructions.md`
2. Use the MongoDB Atlas UI to create the indexes
3. Run the test script to verify they work

### 2. Test Vector Search

**Files:**
- `test_vector_search.js` - MongoDB shell script
- `test_vector_search.ps1` - PowerShell wrapper script

**Purpose:** Tests that the vector search indexes are working correctly by running sample vector searches on all collections.

**Usage:**
```powershell
# PowerShell (recommended)
cd backend/scripts
.\test_vector_search.ps1

# Or directly with mongosh
mongosh "<Your_Atlas_Connection_String>" --file test_vector_search.js
```

## Expected Output

### Create Indexes
```
Creating MongoDB Atlas Vector Search indexes...
Creating vector index for docchunks collection...
Docchunks index result: { "ok": 1, "name": "docchunks_embedding" }
Creating vector index for messages collection...
Messages index result: { "ok": 1, "name": "messages_embedding" }
Creating vector index for memories collection...
Memories index result: { "ok": 1, "name": "memories_embedding" }
Vector search index creation completed!
```

### Test Search
```
Testing MongoDB Atlas Vector Search indexes...
Testing docchunks vector search...
Found 0 docchunks with vector search
Testing messages vector search...
Found 0 messages with vector search
Testing memories vector search...
Found 0 memories with vector search
Vector search testing completed!
Collection document counts:
- docchunks: 0
- messages: 0
- memories: 0
```

## Troubleshooting

### Common Issues

1. **"mongosh is not installed"**
   - Install MongoDB Shell from the official download page
   - Ensure it's added to your system PATH

2. **"MONGODB_URI environment variable is not set"**
   - Check that your `.env` file exists in the backend directory
   - Verify the `MONGODB_URI` is correctly formatted
   - Ensure the connection string includes the database name

3. **"Error creating index"**
   - Check that you have the necessary permissions on your MongoDB Atlas cluster
   - Verify the collection names match your schema
   - Ensure the database exists and is accessible

4. **"Vector search not working"**
   - Verify the indexes were created successfully
   - Check that documents have the `embedding` field populated
   - Ensure the embedding dimensions match (768 for nomic-embed-text-v1.5)

### Verification

To verify the indexes were created successfully, you can run this query in MongoDB Compass or mongosh:

```javascript
// List all search indexes
db.runCommand({ listSearchIndexes: 'docchunks' });
db.runCommand({ listSearchIndexes: 'messages' });
db.runCommand({ listSearchIndexes: 'memories' });
```

## Next Steps

After successfully creating the vector indexes, you can proceed to:
1. **Step 5**: Implement the retrieval service (RAG)
2. **Step 6**: Add conversation summarization
3. **Step 7**: Create the AI question-answering endpoint

The vector indexes are now ready to support semantic search across your document chunks, messages, and user memories.
