# Phase 1 Testing Guide - Step by Step

## Prerequisites Check

### Step 1: Verify .env File
`.env` file mein yeh keys honi chahiye:
```
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=chatbot-index
PINECONE_DIMENSION=1536
MONGO_URI=mongodb://localhost:27017/chatbot
```

### Step 2: Install Dependencies
```bash
cd apps/api
npm install
```

## Testing Steps

### Test 1: Basic Service Tests
```bash
cd apps/api
node test-phase1-integration.js
```

Yeh test karega:
- ✅ Embedding service working
- ✅ LLM service working  
- ✅ Pinecone connection
- ✅ Complete flow simulation

### Test 2: Upload CSV Q&A Data
1. Sample CSV file banao: `sample-qa.csv`
```csv
question,answer,audience
"What services does Mobiloitte provide?","Mobiloitte provides AI development, chatbot solutions, and NLP services","public"
"What is your contact email?","Contact us at info@mobiloitte.com","public"
```

2. Upload karo:
```bash
curl -X POST http://localhost:4000/api/ingest/csv \
  -F "file=@sample-qa.csv" \
  -F "audience=public"
```

Expected response:
```json
{
  "message": "CSV ingestion completed successfully",
  "qaPairsCount": 2,
  "vectorsIndexed": 2
}
```

### Test 3: Test Chat API
```bash
curl -X POST http://localhost:4000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What services does Mobiloitte provide?",
    "sessionId": "test-123"
  }'
```

Expected: Real AI response based on CSV data

### Test 4: Frontend se Test
1. Backend server start karo:
```bash
cd apps/api
npm run dev
```

2. Frontend start karo (different terminal):
```bash
cd apps/web
npm run dev
```

3. Browser mein jao: `http://localhost:3000/chat`
4. Question pucho jo CSV mein hai

## Troubleshooting

### Error: "OpenAI API key not found"
- Check `.env` file mein `OPENAI_API_KEY` hai
- File path: `apps/api/src/.env`

### Error: "Pinecone connection failed"
- Check `PINECONE_API_KEY` correct hai
- Check Pinecone index name: `chatbot-index`
- Index create karna pad sakta hai

### Error: "No matches found"
- Pehle CSV data upload karo
- Check Pinecone mein vectors stored hain
