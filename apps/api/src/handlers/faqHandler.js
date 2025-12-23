/**
 * FAQ Handler
 * Handles "frequently asked questions" queries
 */

const QAPair = require("../database/models/QAPair");

/**
 * Check if query is an FAQ query
 */
function isFAQQuery(normalizedMessage) {
  const lowerNormalized = normalizedMessage.toLowerCase();
  return (
    lowerNormalized.includes("frequently asked questions") ||
    lowerNormalized.includes("frequently asked") ||
    (lowerNormalized.includes("faq") && (lowerNormalized.includes("what") || lowerNormalized.includes("are"))) ||
    lowerNormalized === "faq" ||
    lowerNormalized === "faqs" ||
    (lowerNormalized.includes("what are") && lowerNormalized.includes("frequently"))
  );
}

/**
 * Generate comprehensive FAQs answer from MongoDB Q&A pairs
 */
async function generateFAQAnswer(userRole) {
  // Determine audience filter
  let audienceFilterFAQ;
  if (userRole === "admin") {
    audienceFilterFAQ = { $in: ["admin", "public"] };
  } else if (userRole === "employee") {
    audienceFilterFAQ = { $in: ["public", "employee"] };
  } else {
    audienceFilterFAQ = "public";
  }
  
  console.log(`📊 Fetching Q&A pairs for FAQ answer with audience filter:`, audienceFilterFAQ);
  
  try {
    const topQAPairs = await QAPair.find({
      audience: audienceFilterFAQ
    })
      .limit(20)
      .sort({ _id: 1 });
    
    console.log(`📋 Found ${topQAPairs ? topQAPairs.length : 0} Q&A pairs for FAQ answer`);
    
    if (topQAPairs && topQAPairs.length > 0) {
      let faqAnswer = "Here are some frequently asked questions about Mobiloitte:\n\n";
      
      // Group by category
      const categories = {};
      topQAPairs.forEach(qa => {
        const category = qa.category || "General";
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(qa);
      });
      
      // Format by category
      Object.keys(categories).sort().forEach(category => {
        faqAnswer += `**${category}:**\n`;
        categories[category].forEach((qa, index) => {
          faqAnswer += `${index + 1}. ${qa.question}\n`;
        });
        faqAnswer += "\n";
      });
      
      faqAnswer += "Feel free to ask me about any of these topics for more detailed information!";
      
      console.log(`✅ Generated FAQ answer with ${Object.keys(categories).length} categories`);
      
      return faqAnswer;
    } else {
      console.log("⚠️  No Q&A pairs found in MongoDB for FAQ answer");
      return null;
    }
  } catch (error) {
    console.error("❌ Error generating FAQs answer:", error.message);
    console.error("❌ Error stack:", error.stack);
    return null;
  }
}

module.exports = {
  isFAQQuery,
  generateFAQAnswer
};
