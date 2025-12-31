// Embeddings Service - Supports Cohere + Local Xenova (FREE) + Mock
// Local embeddings = No API | No Cost | No Rate Limit

const { CohereClient } = require("cohere-ai");
const config = require("../config/env");

class EmbeddingService {
  constructor() {
    // ---------------- COHERE INIT ----------------
    if (config.cohere.apiKey) {
      try {
        this.cohereClient = new CohereClient({
          token: config.cohere.apiKey,
        });

        this.cohereModel =
          config.cohere.embeddingModel || "embed-english-v3.0";
        this.cohereDimension =
          config.cohere.embeddingDimension || 1024;

        console.log("✅ Cohere embeddings initialized (API mode)");
      } catch (error) {
        console.warn("⚠️ Cohere init failed:", error.message);
        this.cohereClient = null;
      }
    } else {
      this.cohereClient = null;
    }

    this.useCohere = !!this.cohereClient;

    // ---------------- XENOVA INIT FLAGS ----------------
    this.xenovaReady = false;
    this.xenovaEmbedder = null;
    this.xenovaDimension = 768;

    // Default Dimension
    this.dimension = this.useCohere
      ? this.cohereDimension
      : this.xenovaDimension;
  }

  // ---------------- LOAD XENOVA MODEL (ESM SAFE) ----------------
  async loadXenova() {
    if (this.xenovaReady) return;

    console.log("⏳ Loading Xenova local embedding model...");

    const transformers = await import("@xenova/transformers");

    this.xenovaEmbedder = await transformers.pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );

    this.dimension = this.xenovaDimension;
    this.xenovaReady = true;

    console.log("✅ Xenova embeddings ready (FREE | No API)");
  }

  // ---------------- SINGLE EMBEDDING ----------------
  async generateEmbedding(text, inputType = "search_document") {
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    text = text.trim();

    // ---------- PRIORITY 1: COHERE ----------
    if (this.useCohere) {
      try {
        const response = await this.cohereClient.embed({
          texts: [text],
          model: this.cohereModel,
          inputType,
          truncate: "END",
        });

        const embedding = response.embeddings[0];
        console.log(
          `✅ Cohere embedding generated (${embedding.length} dims)`
        );
        return embedding;
      } catch (error) {
        console.error("❌ Cohere embedding error:", error.message);
      }
    }

    // ---------- PRIORITY 2: XENOVA LOCAL ----------
    try {
      await this.loadXenova();

      const output = await this.xenovaEmbedder(text, {
        pooling: "mean",
        normalize: true,
      });

      const embedding = Array.from(output.data);

      console.log(
        `✅ Xenova Local Embedding generated (${embedding.length} dims)`
      );

      return embedding;
    } catch (error) {
      console.error("❌ Xenova embedding error:", error.message);
    }

    // ---------- PRIORITY 3: MOCK ----------
    console.warn("⚠️ Using MOCK embeddings fallback");
    return this.generateMockEmbedding(text);
  }

  // ---------------- MOCK ----------------
  generateMockEmbedding(text) {
    const hash = this.simpleHash(text);
    const embedding = Array(this.dimension).fill(0);

    for (let i = 0; i < this.dimension; i++) {
      embedding[i] = Math.sin(hash + i) * 0.5 + 0.5;
    }

    console.log(
      `📝 Mock embedding generated (${text.substring(
        0,
        40
      )}...) dim=${embedding.length}`
    );

    return embedding;
  }

  simpleHash(str) {
    let hash = 0;
    for (let c of str) {
      hash = (hash << 5) - hash + c.charCodeAt(0);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  // ---------------- BATCH EMBEDDINGS ----------------
  async generateEmbeddingsBatch(texts) {
    if (!texts || texts.length === 0) return [];

    const validTexts = texts.filter((t) => t && t.trim().length > 0);
    if (validTexts.length === 0) return [];

    // ---------- PRIORITY 1: COHERE BATCH ----------
    if (this.useCohere) {
      try {
        const batchSize = 96;
        const batches = [];

        for (let i = 0; i < validTexts.length; i += batchSize) {
          batches.push(validTexts.slice(i, i + batchSize));
        }

        const allEmbeddings = [];

        for (let i = 0; i < batches.length; i++) {
          console.log(`📦 Cohere Batch ${i + 1}/${batches.length}`);

          const response = await this.cohereClient.embed({
            texts: batches[i],
            model: this.cohereModel,
            inputType: "search_document",
            truncate: "END",
          });

          allEmbeddings.push(...response.embeddings);
        }

        console.log(`✅ Cohere Batch Done: ${allEmbeddings.length}`);
        return allEmbeddings;
      } catch (err) {
        console.error("❌ Cohere batch error:", err.message);
      }
    }

    // ---------- PRIORITY 2: XENOVA ----------
    try {
      await this.loadXenova();

      const results = [];

      for (const text of validTexts) {
        const output = await this.xenovaEmbedder(text.trim(), {
          pooling: "mean",
          normalize: true,
        });

        results.push(Array.from(output.data));
      }

      console.log(`✅ Xenova Batch Done: ${results.length}`);
      return results;
    } catch (e) {
      console.error("❌ Xenova batch error:", e.message);
    }

    // ---------- PRIORITY 3: MOCK ----------
    console.warn("⚠️ Batch fallback → Mock embeddings");
    return validTexts.map((t) => this.generateMockEmbedding(t));
  }

  // ---------------- HEALTH CHECK ----------------
  async testConnection() {
    const serviceInfo = {
      cohere: this.useCohere ? "✅ Active" : "❌ Not available",
      xenova: this.xenovaReady
        ? "✅ Active"
        : "⏳ Will load when needed",
    };

    try {
      const emb = await this.generateEmbedding("test message");
      return {
        success: true,
        dimension: emb.length,
        service: this.useCohere
          ? "Cohere"
          : this.xenovaReady
          ? "Xenova"
          : "Mock",
        services: serviceInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        services: serviceInfo,
      };
    }
  }
}

module.exports = new EmbeddingService();
