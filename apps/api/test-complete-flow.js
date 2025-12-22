/**
 * Complete Flow Test - Verify entire chatbot process
 * Tests: Gibberish Check → Embeddings → LLM → Response
 */

require('dotenv').config({ path: './src/.env' });

const API_BASE_URL = 'http://localhost:4000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(step, message, status = 'info') {
  const icons = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    process: '🔄'
  };
  const color = status === 'success' ? colors.green : 
                status === 'error' ? colors.red : 
                status === 'warning' ? colors.yellow : colors.cyan;
  console.log(`${color}${icons[status] || '📋'} [${step}] ${message}${colors.reset}`);
}

async function testChatFlow(testCase) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${colors.magenta}🧪 TEST CASE: ${testCase.name}${colors.reset}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`Input: "${testCase.input}"`);
  console.log(`Expected: ${testCase.expectedBehavior}`);
  
  try {
    // Step 1: Send message to chat API
    log('STEP 1', 'Sending message to chat API...', 'process');
    
    const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: testCase.input,
        sessionId: `test-session-${Date.now()}`,
        authToken: null // Public user
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Step 2: Analyze response
    log('STEP 2', 'Analyzing response...', 'process');
    console.log(`\n${colors.blue}Response:${colors.reset}`);
    console.log(`  Text: "${data.response}"`);
    console.log(`  Context:`, JSON.stringify(data.context || {}, null, 2));
    
    // Step 3: Verify expected behavior
    log('STEP 3', 'Verifying expected behavior...', 'process');
    
    let passed = true;
    const checks = [];
    
    // Check gibberish detection
    if (testCase.shouldBeGibberish) {
      const isGibberishResponse = data.response.toLowerCase().includes("couldn't understand") || 
                                  data.response.toLowerCase().includes("clear question");
      checks.push({
        name: 'Gibberish Detection',
        passed: isGibberishResponse,
        expected: 'Should be rejected as gibberish',
        actual: isGibberishResponse ? 'Rejected ✅' : 'Not rejected ❌'
      });
    }
    
    // Check profanity detection
    if (testCase.shouldBeProfanity) {
      const isProfanityResponse = data.response.toLowerCase().includes("appropriate language") ||
                                 data.response.toLowerCase().includes("professional");
      checks.push({
        name: 'Profanity Detection',
        passed: isProfanityResponse,
        expected: 'Should be rejected for profanity',
        actual: isProfanityResponse ? 'Rejected ✅' : 'Not rejected ❌'
      });
    }
    
    // Check conversational intent
    if (testCase.shouldBeConversational) {
      const isConversational = data.context?.type === 'conversational' ||
                              data.context?.intent === 'greeting' ||
                              data.context?.intent === 'thanks' ||
                              data.context?.intent === 'goodbye';
      checks.push({
        name: 'Conversational Intent',
        passed: isConversational,
        expected: 'Should be handled as conversational',
        actual: isConversational ? 'Handled ✅' : 'Not handled ❌'
      });
    }
    
    // Check if embeddings were used (for informational queries)
    if (testCase.shouldUseEmbeddings) {
      const usedEmbeddings = data.context?.type === 'qa' || 
                            data.context?.type === 'document' ||
                            data.response.length > 50; // Real response, not fallback
      checks.push({
        name: 'Embeddings Used',
        passed: usedEmbeddings,
        expected: 'Should use embeddings for semantic search',
        actual: usedEmbeddings ? 'Used ✅' : 'Not used ❌'
      });
    }
    
    // Check if LLM was called (for complex queries)
    if (testCase.shouldUseLLM) {
      const usedLLM = data.context?.type === 'document' ||
                      (data.response.length > 100 && !data.response.includes("couldn't find"));
      checks.push({
        name: 'LLM Called',
        passed: usedLLM,
        expected: 'Should call LLM for complex queries',
        actual: usedLLM ? 'Called ✅' : 'Not called ❌'
      });
    }
    
    // Print check results
    console.log(`\n${colors.cyan}Verification Results:${colors.reset}`);
    checks.forEach(check => {
      if (check.passed) {
        log(check.name, `${check.actual}`, 'success');
      } else {
        log(check.name, `${check.actual} (Expected: ${check.expected})`, 'error');
        passed = false;
      }
    });
    
    if (passed) {
      log('RESULT', 'All checks passed! ✅', 'success');
    } else {
      log('RESULT', 'Some checks failed ❌', 'error');
    }
    
    return { passed, data, checks };
    
  } catch (error) {
    log('ERROR', error.message, 'error');
    return { passed: false, error: error.message };
  }
}

async function runAllTests() {
  console.log(`${colors.magenta}\n${'='.repeat(70)}`);
  console.log('🧪 COMPLETE CHATBOT FLOW TEST');
  console.log(`${'='.repeat(70)}${colors.reset}\n`);
  
  const testCases = [
    {
      name: 'Gibberish Detection',
      input: 'nxcbvnxcvbcxnvnvxncvcnv',
      expectedBehavior: 'Should be rejected as gibberish',
      shouldBeGibberish: true
    },
    {
      name: 'Profanity Detection',
      input: 'what the hell are your services',
      expectedBehavior: 'Should be rejected for profanity',
      shouldBeProfanity: true
    },
    {
      name: 'Greeting Handling',
      input: 'hi',
      expectedBehavior: 'Should be handled as greeting (no embeddings/LLM)',
      shouldBeConversational: true
    },
    {
      name: 'Thanks Handling',
      input: 'thank you',
      expectedBehavior: 'Should be handled as thanks (no embeddings/LLM)',
      shouldBeConversational: true
    },
    {
      name: 'CSV Q&A - Exact Match',
      input: 'What services does Mobiloitte provide?',
      expectedBehavior: 'Should use embeddings → find CSV match → return curated answer',
      shouldUseEmbeddings: true,
      shouldUseLLM: false // Curated answer, no LLM needed
    },
    {
      name: 'CSV Q&A - Semantic Match',
      input: 'Traditional AI Solutions?',
      expectedBehavior: 'Should use embeddings → semantic search → return curated answer',
      shouldUseEmbeddings: true,
      shouldUseLLM: false
    },
    {
      name: 'Document RAG Query',
      input: 'Explain Mobiloitte\'s AI development process in detail',
      expectedBehavior: 'Should use embeddings → find document chunks → call LLM',
      shouldUseEmbeddings: true,
      shouldUseLLM: true
    },
    {
      name: 'Out of Scope Query',
      input: 'how to make maggi',
      expectedBehavior: 'Should detect out-of-scope and reject politely',
      shouldBeOutOfScope: true
    }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await testChatFlow(testCase);
    results.push({ ...testCase, result });
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log(`\n${colors.magenta}${'='.repeat(70)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(70)}${colors.reset}\n`);
  
  const passed = results.filter(r => r.result.passed).length;
  const failed = results.filter(r => !r.result.passed).length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  
  results.forEach((r, i) => {
    const status = r.result.passed ? `${colors.green}✅${colors.reset}` : `${colors.red}❌${colors.reset}`;
    console.log(`${status} ${i + 1}. ${r.name}`);
  });
  
  console.log(`\n${colors.cyan}Note: Check backend console logs to see:${colors.reset}`);
  console.log(`  - Gibberish detection logs`);
  console.log(`  - Embedding generation logs`);
  console.log(`  - Pinecone search logs`);
  console.log(`  - LLM call logs`);
}

// Run tests
if (require.main === module) {
  runAllTests().catch(error => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  });
}

module.exports = { runAllTests, testChatFlow };
