## StudyAI Memory & Hallucination-Reduction Implementation Plan

This checklist guides you to implement layered memory, citation-grounded RAG, and guardrails across your MERN + Fireworks stack. Each step includes:
- Goal, files to touch
- A “vibe coding” prompt you can paste into your AI/code assistant
- A Windows PowerShell test script or commands to verify the step

Notes
- Use separate commands per line in PowerShell (no &&).
- Keep your existing environment variables up to date (see README).
- Prefer Tailwind classes directly in components for any UI work [[memory:8727222]].

---

### Step 0 — Preflight checks (env, services)
- Goal: Ensure backend, MongoDB, and Fireworks API are reachable.
- Files: none

Vibe coding prompt
```
No code. Confirm .env values exist: MONGODB_URI, FIREWORKS_API_KEY, JWT_SECRET, PORT.
Add a simple /api/health route (if missing) that returns { ok: true }.
```

Test (PowerShell)
```
cd backend
npm run dev
```
In a new PowerShell window:
```
Invoke-RestMethod -Uri http://localhost:5000/api/health -Method Get | ConvertTo-Json -Depth 5
```
Success criteria: JSON output contains ok = true.

---

### Step 1 — Data models for memory and messages
- Goal: Add Mongoose schemas for conversations, messages, memories, and docChunks with vector fields.
- Files: backend/models/Conversation.js, Message.js, Memory.js, DocChunk.js

Vibe coding prompt
```
Create Mongoose models:
- Conversation { userId:ObjectId, title:String, sessionSummary:String, createdAt, updatedAt }
- Message { conversationId:ObjectId, role:'user'|'assistant'|'system', content:String, tokens:Number, embedding:[Number], sourceRefs:[{type:String,id:String}], createdAt }
- Memory { userId:ObjectId, kind:'profile'|'fact'|'preference', content:String, embedding:[Number], updatedAt }
- DocChunk { userId:ObjectId, docId:String, page:Number, text:String, embedding:[Number], metadata:Object, updatedAt }
Export with clear names and indexes on conversationId, userId, and embedding (vector field stored as array).
```

Test (PowerShell)
```
cd backend
node -e "require('dotenv').config(); const mongoose=require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(()=>{console.log('mongo ok'); process.exit(0)}).catch(e=>{console.error(e); process.exit(1)})"
```
Success criteria: Prints "mongo ok" with no schema errors on import (ensure files compile).

---

### Step 2 — Fireworks embeddings utility
- Goal: Add a reusable function to embed text via Fireworks embeddings model.
- Files: backend/services/embeddings.js

Vibe coding prompt
```
Create embeddings.js exporting async function embedTexts(texts:string[]): Promise<number[][]> using Fireworks Embeddings API.
Handle chunking (max ~800 tokens per item) and API key from env.
Include exponential backoff on 429/5xx and basic input sanitization.
```

Test (PowerShell)
```
cd backend
node -e "(async()=>{const {embedTexts}=require('./services/embeddings'); const v=await embedTexts(['hello world','photosynthesis']); console.log(v.length, v[0].length);})()"
```
Success criteria: Prints 2 and a reasonable embedding dimension (e.g., 768 or similar).

---

### Step 3 — PDF ingestion and chunking pipeline
- Goal: Implement a service that chunks PDF-extracted text into ~800-token chunks with 200-token overlap and stores DocChunk records with embeddings.
- Files: backend/services/ingest.js, backend/controllers/aiController.js (wire when ready)

Vibe coding prompt
```
Implement ingestChunks({ userId, docId, fullText }):
- Split fullText into semantic chunks (~800 tokens, 200 overlap)
- Call embedTexts for each chunk
- Persist DocChunk with page (best-effort), text, metadata { filename, course }, and embedding
Return count of chunks stored.
```

Test (PowerShell)
```
cd backend
node -e "(async()=>{const {ingestChunks}=require('./services/ingest'); const n=await ingestChunks({userId:'000000000000000000000001', docId:'demo', fullText:'Chloroplasts capture light energy... (repeat to simulate long text)'}); console.log('chunks:',n)})()"
```
Success criteria: Prints a positive chunk count; verify documents in MongoDB.

---

### Step 4 — MongoDB Atlas Vector Search indexes
- Goal: Create vector indexes on DocChunk.embedding, Message.embedding, Memory.embedding.
- Files: Atlas UI or mongosh script

Vibe coding prompt
```
Provide a mongosh script to create Atlas Vector Search indexes for collections: docchunks, messages, memories with cosine similarity on field embedding.
```

Test (PowerShell)
```
# Requires mongosh installed and Atlas connection string
mongosh "<Your_Atlas_Connection_String>" --eval "db.runCommand({ createSearchIndex: 'docchunks_embedding', collection: 'docchunks', definition: { fields: [{ type: 'vector', path: 'embedding', numDimensions: 768, similarity: 'cosine' }] } })"
```
Success criteria: Command returns ok:1. Repeat for messages and memories.

---

### Step 5 — Retrieval service (RAG)
- Goal: Implement a function that retrieves top-K chunks from docChunks, messages, memories, plus last-N raw messages.
- Files: backend/services/retrieval.js

Vibe coding prompt
```
Create retrieveContext({ userId, conversationId, query, kDocs=5, kMsgs=3, kMems=2, lastN=12 }):
- Embed the query
- Vector search each collection with relevance threshold ~0.3
- Merge, dedupe by docId/id, sort by score, and return structured context { docChunks, pastMessages, memories, lastTurns }.
```

Test (PowerShell)
```
cd backend
node -e "(async()=>{const {retrieveContext}=require('./services/retrieval'); const c=await retrieveContext({userId:'000000000000000000000001', conversationId:'000000000000000000000002', query:'Explain photosynthesis'}); console.log(Object.keys(c));})()"
```
Success criteria: Prints keys including docChunks, pastMessages, memories, lastTurns; counts reasonable.

---

### Step 6 — Conversation summarization
- Goal: Maintain a rolling sessionSummary updated every ~12 turns.
- Files: backend/services/summarize.js, backend/controllers/messagesController.js

Vibe coding prompt
```
Implement summarizeConversation({ conversationId }):
- Pull last ~30 messages, generate ~600-800 token summary via Fireworks chat
- Store on Conversation.sessionSummary
Expose updateSummaryIfNeeded(conversationId) to call after each turn when message count % 12 === 0.
```

Test (PowerShell)
```
cd backend
node -e "(async()=>{const {summarizeConversation}=require('./services/summarize'); const s=await summarizeConversation({conversationId:'000000000000000000000002'}); console.log(!!s && s.length>0);})()"
```
Success criteria: Prints True; summary is persisted on the conversation document.

---

### Step 7 — JSON-constrained answer generation with citations
- Goal: Implement POST /api/ai/ask-question that performs RAG, enforces JSON schema, and returns citations.
- Files: backend/routes/ai.js, backend/controllers/aiController.js, backend/services/llm.js

Vibe coding prompt
```
Create an endpoint POST /api/ai/ask-question:
- Validate conversationId and user auth
- Use retrieveContext + sessionSummary + last N turns to build CONTEXT
- Call Fireworks chat with system prompt that requires:
  - Answer only from CONTEXT; if insufficient, ask a clarifying question or say "I don't know"
  - JSON output: { answer:string, citations:[{type:'pdf'|'chat'|'profile',id:string,page?:number,quote?:string}], uncertainty:{isUncertain:boolean,reasons:string[]} }
- Validate JSON server-side; if invalid, retry once with stricter instruction
- Store assistant message with embedding and sourceRefs
Return the validated JSON.
```

Test (PowerShell)
```
$body = @{ conversationId = "000000000000000000000002"; question = "Teach me photosynthesis basics" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:5000/api/ai/ask-question -Method Post -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 6
```
Success criteria: Valid JSON with answer, citations[], uncertainty; citations reference existing docChunks/messages/memories.

---

### Step 8 — Guardrails verifier (post-generation)
- Goal: Add a lightweight verifier that flags unsupported statements vs. citations and optionally regenerates.
- Files: backend/services/verify.js, integrate into aiController answer flow

Vibe coding prompt
```
Implement verifySupport(answerJson, context):
- Identify claims (sentences) and check whether at least one citation supports each
- If unsupported claims exist, either regenerate with stricter instruction or mark uncertainty.isUncertain = true with reasons
```

Test (PowerShell)
```
cd backend
node -e "(async()=>{const {verifySupport}=require('./services/verify'); const res=await verifySupport({answer:'The sun is blue.', citations:[]},{docChunks:[]}); console.log(res);})()"
```
Success criteria: Verifier reports uncertainty with reasons about unsupported claim.

---

### Step 9 — Frontend references UI
- Goal: Display a References section showing PDF chunk quotes, message links, and profile facts used.
- Files: frontend/src/components/Answer.tsx, frontend/src/components/References.tsx

Vibe coding prompt
```
Implement UI components to render the assistant JSON:
- Answer body text
- References list with per-item type, link (pdf page, prior message), and quote snippet
Use Tailwind classes inline within components (no global CSS) [[memory:8727222]].
```

Test (PowerShell)
```
cd frontend
npm run dev
```
Manual: Ask a question, verify references render with working links and quotes.

---

### Step 10 — Feedback endpoint for hallucinations
- Goal: Capture user feedback and store flags for analysis.
- Files: backend/routes/ai.js, backend/controllers/aiController.js (extend), backend/models/Feedback.js

Vibe coding prompt
```
Add Feedback model { userId, conversationId, messageId, kind:'hallucination'|'good'|'bad', comment, createdAt }.
Implement POST /api/ai/feedback to save feedback and basic analytics counters.
```

Test (PowerShell)
```
$body = @{ conversationId = "000000000000000000000002"; messageId = "last-assistant-message-id"; kind = "hallucination"; comment = "Unsupported claim" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:5000/api/ai/feedback -Method Post -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 5
```
Success criteria: Endpoint returns saved feedback with _id.

---

### Step 11 — Configurable thresholds and temperatures
- Goal: Make K values, relevance threshold, and temperatures configurable via env.
- Files: backend/config/ai.js

Vibe coding prompt
```
Create ai config module exporting defaults and env overrides:
- K_DOCS, K_MSGS, K_MEMS, LAST_N
- RELEVANCE_THRESHOLD (default 0.30)
- TEMP_FACT (default 0.1), TEMP_TEACH (default 0.4)
Use in retrieval and LLM calls.
```

Test (PowerShell)
```
cd backend
node -e "process.env.RELEVANCE_THRESHOLD='0.5'; const cfg=require('./config/ai'); console.log(cfg.RELEVANCE_THRESHOLD)"
```
Success criteria: Prints 0.5.

---

### Step 12 — Logging and metrics
- Goal: Log model, prompt size, retrieved IDs, answer length, uncertainty, invalid-JSON rate.
- Files: backend/middleware/logging.js, integrate in aiController and services

Vibe coding prompt
```
Add minimal logging middleware and helper functions to log per-request metrics and RAG stats.
Ensure PII-safe logging (no raw content), only IDs and sizes.
```

Test (PowerShell)
```
cd backend
npm run dev
```
Manual: Trigger /api/ai/ask-question and inspect console/log output for metrics.

---

## System prompt (starter slice to reuse)
Use this in your LLM service for steps 6–8.
```
You are a study assistant. Only answer from the provided CONTEXT.
If CONTEXT is insufficient, ask a clarifying question or say "I don't know".
For factual statements, include citations with exact source ids and quotes.
Do not invent sources. Output valid JSON per the provided schema.
```

## JSON schema (server must validate)
```
{
  "answer": "string",
  "citations": [
    {"type": "pdf" | "chat" | "profile", "id": "string", "page": 0, "quote": "string"}
  ],
  "uncertainty": { "isUncertain": true, "reasons": ["string"] }
}
```

## Final verification checklist
- Retrieval includes at least 3 items or response defers with uncertainty.
- JSON output passes server validation on first or second attempt.
- Each answer shows references in the UI with working links.
- Feedback endpoint records hallucination flags.
- Logs capture RAG stats without PII.


