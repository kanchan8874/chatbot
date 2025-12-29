require('dotenv').config({ path: './src/.env' });

console.log("PINECONE_API_KEY:", process.env.PINECONE_API_KEY);
console.log("PINECONE_INDEX_NAME:", process.env.PINECONE_INDEX_NAME);