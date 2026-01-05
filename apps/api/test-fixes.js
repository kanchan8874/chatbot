const { hasStrongLexicalOverlap } = require("./src/utils/searchUtils");

console.log("🚀 Starting Search Refinement Verification (with Expansion)...");

/**
 * Mock expansion logic from clientHandler.js
 */
function expandQuery(message) {
  const normalizedMessage = message.toLowerCase();
  const genericCompanyContexts = [
    "this company", "the company", "your company", "this organization", "your organization",
    "is company", "of company", "about company"
  ];
  const hasOfficialName = normalizedMessage.includes("mobiloitte");
  const hasTypo = normalizedMessage.includes("mobiloite");
  const hasGeneric = genericCompanyContexts.some(ctx => normalizedMessage.includes(ctx));
  
  if (!hasOfficialName && (hasGeneric || hasTypo)) {
    return `${message} (Mobiloitte)`;
  }
  return message;
}

// --- 1. Typo-Resilient Overlap Check ---
const testCases = [
  {
    query: "give me some information of mobiloite private limited??",
    candidate: "What is Mobiloitte's contact information?",
    expected: true,
    desc: "Typo 'mobiloite' vs 'Mobiloitte's' with punctuation"
  },
  {
    query: "Mobiloite services info",
    candidate: "What services does Mobiloitte provide?",
    expected: true,
    desc: "Typo 'Mobiloite' vs 'Mobiloitte'"
  },
  {
    query: "this company hq",
    candidate: "Where is Mobiloitte's headquarters located?",
    expected: true,
    desc: "Generic 'this company' -> 'Mobiloitte' + 'hq' -> 'headquarters'"
  }
];

console.log("\n--- 1. Lexical Overlap with EXPANSION & Punctuation ---");
testCases.forEach(t => {
  const expanded = expandQuery(t.query);
  const result = hasStrongLexicalOverlap(expanded, t.candidate);
  console.log(`[${t.desc}] \n  Query: "${t.query}" \n  Expanded: "${expanded}" \n  Result: ${result} ${result === t.expected ? '✅' : '❌'}`);
});

console.log("\n✅ Verification script finished.");
