#!/bin/bash
# Quick Test Commands for Phase 2
# Copy-paste these commands one by one

echo "=========================================="
echo "PHASE 2 REAL API TESTING"
echo "=========================================="
echo ""

# Test 1: CSV Upload
echo "TEST 1: CSV Upload"
echo "Command:"
echo "curl -X POST http://localhost:4000/api/ingest/csv -F \"file=@mobiloitte-qa-data.csv\" -F \"audience=public\""
echo ""
echo "Expected:"
echo "  - Response: {\"message\":\"CSV ingestion completed successfully\",\"qaPairsCount\":10,\"vectorsIndexed\":10}"
echo "  - Console: Raw file stored, CSV parsed, embeddings generated, Pinecone updated"
echo "  - File check: ls storage/raw/csv/ → CSV file dikhni chahiye"
echo ""

# Test 2: Check Storage
echo "TEST 2: Verify Storage"
echo "Command:"
echo "ls -la storage/raw/csv/"
echo "ls -la storage/raw/docs/"
echo ""
echo "Expected: Uploaded files dikhni chahiye"
echo ""

# Test 3: Chat API
echo "TEST 3: Chat API Test"
echo "Command:"
echo "curl -X POST http://localhost:4000/api/chat/message -H \"Content-Type: application/json\" -d '{\"message\":\"What services does Mobiloitte provide?\",\"sessionId\":\"test-123\"}'"
echo ""
echo "Expected:"
echo "  - Response with proper answer from CSV"
echo "  - No fallback mode message"
echo ""

echo "=========================================="
echo "All tests complete!"
echo "=========================================="
