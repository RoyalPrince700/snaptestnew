# MongoDB Atlas Vector Search Index Creation - UI Instructions

Since the mongosh commands are encountering "Attribute mappings missing" errors, the recommended approach is to create the vector search indexes through the MongoDB Atlas UI.

## Step-by-Step Instructions

### 1. Access MongoDB Atlas
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Log in to your account
3. Navigate to your `snaptest` cluster

### 2. Create Vector Search Index for `docchunks` Collection

1. **Navigate to Search Indexes:**
   - In the Atlas UI, go to your cluster
   - Click on "Search" in the left sidebar
   - Click "Create Index"

2. **Configure the Index:**
   - **Database:** `snaptest`
   - **Collection:** `docchunks`
   - **Index Name:** `docchunks_embedding`
   - **Index Type:** Vector Search

3. **Define the Index Fields:**
   ```json
   {
     "fields": [
       {
         "type": "vector",
         "path": "embedding",
         "numDimensions": 768,
         "similarity": "cosine"
       },
       { "type": "filter", "path": "userId" },
       { "type": "filter", "path": "docId" }
     ]
   }
   ```

4. **Create the Index:**
   - Click "Next" to review
   - Click "Create Index"

### 3. Create Vector Search Index for `messages` Collection

1. **Navigate to Search Indexes:**
   - Click "Create Index" again

2. **Configure the Index:**
   - **Database:** `snaptest`
   - **Collection:** `messages`
   - **Index Name:** `messages_embedding`
   - **Index Type:** Vector Search

3. **Define the Index Fields:**
   ```json
   {
     "fields": [
       {
         "type": "vector",
         "path": "embedding",
         "numDimensions": 768,
         "similarity": "cosine"
       },
       { "type": "filter", "path": "conversationId" }
     ]
   }
   ```

4. **Create the Index:**
   - Click "Next" to review
   - Click "Create Index"

### 4. Create Vector Search Index for `memories` Collection

1. **Navigate to Search Indexes:**
   - Click "Create Index" again

2. **Configure the Index:**
   - **Database:** `snaptest`
   - **Collection:** `memories`
   - **Index Name:** `memories_embedding`
   - **Index Type:** Vector Search

3. **Define the Index Fields:**
   ```json
   {
     "fields": [
       {
         "type": "vector",
         "path": "embedding",
         "numDimensions": 768,
         "similarity": "cosine"
       },
       { "type": "filter", "path": "userId" }
     ]
   }
   ```

4. **Create the Index:**
   - Click "Next" to review
   - Click "Create Index"

## Verification

After creating all three indexes, you should see:
- `docchunks_embedding` on the `docchunks` collection
- `messages_embedding` on the `messages` collection
- `memories_embedding` on the `memories` collection

## Test the Indexes

Once created, you can test the indexes using the test script:

```powershell
cd backend/scripts
.\test_vector_search.ps1
```

## Alternative: Atlas Search API

If you prefer to use the Atlas Search API programmatically, you can use the following curl commands:

### Create docchunks index:
```bash
curl -X POST "https://cloud.mongodb.com/api/atlas/v1.0/groups/{PROJECT_ID}/clusters/{CLUSTER_NAME}/fts/indexes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {API_KEY}" \
  -d '{
    "collectionName": "docchunks",
    "database": "snaptest",
    "name": "docchunks_embedding",
    "type": "vectorSearch",
    "definition": {
      "fields": [
        {
          "type": "vector",
          "path": "embedding",
          "numDimensions": 768,
          "similarity": "cosine"
        },
        { "type": "filter", "path": "userId" },
        { "type": "filter", "path": "docId" }
      ]
    }
  }'
```

### Create messages index:
```bash
curl -X POST "https://cloud.mongodb.com/api/atlas/v1.0/groups/{PROJECT_ID}/clusters/{CLUSTER_NAME}/fts/indexes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {API_KEY}" \
  -d '{
    "collectionName": "messages",
    "database": "snaptest",
    "name": "messages_embedding",
    "type": "vectorSearch",
    "definition": {
      "fields": [
        {
          "type": "vector",
          "path": "embedding",
          "numDimensions": 768,
          "similarity": "cosine"
        },
        { "type": "filter", "path": "conversationId" }
      ]
    }
  }'
```

### Create memories index:
```bash
curl -X POST "https://cloud.mongodb.com/api/atlas/v1.0/groups/{PROJECT_ID}/clusters/{CLUSTER_NAME}/fts/indexes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {API_KEY}" \
  -d '{
    "collectionName": "memories",
    "database": "snaptest",
    "name": "memories_embedding",
    "type": "vectorSearch",
    "definition": {
      "fields": [
        {
          "type": "vector",
          "path": "embedding",
          "numDimensions": 768,
          "similarity": "cosine"
        },
        { "type": "filter", "path": "userId" }
      ]
    }
  }'
```

## Notes

- The vector dimensions are set to 768, which matches the `nomic-ai/nomic-embed-text-v1.5` model used in the embeddings service
- All indexes use cosine similarity, which is recommended for text embeddings
- The indexes will be built in the background and may take a few minutes to become available
- Once created, the indexes will automatically update when new documents with embeddings are added
