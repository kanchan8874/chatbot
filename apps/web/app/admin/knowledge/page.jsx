"use client";

import { useState } from "react";
import { API_ENDPOINTS } from "../../../config/api";

export default function KnowledgePage() {
  const [csvFile, setCsvFile] = useState(null);
  const [docFile, setDocFile] = useState(null);
  const [audience, setAudience] = useState("public");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadType, setUploadType] = useState("csv"); // csv, doc, web

  const handleCSVUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      setUploadStatus({ type: "error", message: "Please select a CSV file" });
      return;
    }

    setUploading(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      formData.append("file", csvFile);
      formData.append("audience", audience);

      const response = await fetch(API_ENDPOINTS.INGEST.CSV, {
        method: "POST",
        headers: {
          // Don't set Content-Type - browser will set it with boundary
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadStatus({
          type: "success",
          message: `✅ CSV uploaded successfully! ${data.qaPairsCount || 0} QA pairs indexed.`,
        });
        setCsvFile(null);
        // Reset file input
        const fileInput = document.getElementById("csv-file");
        if (fileInput) fileInput.value = "";
      } else {
        setUploadStatus({
          type: "error",
          message: `❌ Upload failed: ${data.error || data.message}`,
        });
      }
    } catch (error) {
      setUploadStatus({
        type: "error",
        message: `❌ Error: ${error.message}`,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDocUpload = async (e) => {
    e.preventDefault();
    if (!docFile) {
      setUploadStatus({ type: "error", message: "Please select a document file" });
      return;
    }

    setUploading(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      formData.append("file", docFile);
      formData.append("audience", audience);

      const response = await fetch(API_ENDPOINTS.INGEST.DOCS, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadStatus({
          type: "success",
          message: `✅ Document uploaded successfully! ${data.chunksCount || 0} chunks indexed.`,
        });
        setDocFile(null);
        const fileInput = document.getElementById("doc-file");
        if (fileInput) fileInput.value = "";
      } else {
        setUploadStatus({
          type: "error",
          message: `❌ Upload failed: ${data.error || data.message}`,
        });
      }
    } catch (error) {
      setUploadStatus({
        type: "error",
        message: `❌ Error: ${error.message}`,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-chat-bg p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Knowledge Base Management</h1>
          <p className="text-chat-text-secondary">
            Upload CSV Q&A files or documents to enhance the chatbot knowledge base
          </p>
        </div>

        {/* Upload Type Selector */}
        <div className="mb-6 flex gap-3 border-b border-subtle">
          <button
            onClick={() => setUploadType("csv")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              uploadType === "csv"
                ? "text-white border-b-2 border-chat-user"
                : "text-chat-text-secondary hover:text-white"
            }`}
          >
            CSV Q&A Upload
          </button>
          <button
            onClick={() => setUploadType("doc")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              uploadType === "doc"
                ? "text-white border-b-2 border-chat-user"
                : "text-chat-text-secondary hover:text-white"
            }`}
          >
            Document Upload
          </button>
        </div>

        {/* CSV Upload Form */}
        {uploadType === "csv" && (
          <div className="bg-surface rounded-xl border border-subtle p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Upload CSV Q&A File</h2>
            <form onSubmit={handleCSVUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  CSV File (question, answer, audience, category, tags)
                </label>
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files[0])}
                  className="w-full px-4 py-2.5 rounded-lg border border-subtle bg-chat-input text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-chat-user file:text-white hover:file:bg-chat-accent-hover cursor-pointer"
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Audience</label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-subtle bg-chat-input text-white focus:outline-none focus:ring-2 focus:ring-chat-user"
                  disabled={uploading}
                >
                  <option value="public">Public</option>
                  <option value="employee">Employee</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={uploading || !csvFile}
                className="w-full px-4 py-3 rounded-lg bg-chat-user text-white font-medium hover:bg-chat-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? "Uploading..." : "Upload CSV"}
              </button>
            </form>
          </div>
        )}

        {/* Document Upload Form */}
        {uploadType === "doc" && (
          <div className="bg-surface rounded-xl border border-subtle p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Upload Document</h2>
            <form onSubmit={handleDocUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Document File (PDF, Word DOCX)
                </label>
                <input
                  id="doc-file"
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={(e) => setDocFile(e.target.files[0])}
                  className="w-full px-4 py-2.5 rounded-lg border border-subtle bg-chat-input text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-chat-user file:text-white hover:file:bg-chat-accent-hover cursor-pointer"
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Audience</label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-subtle bg-chat-input text-white focus:outline-none focus:ring-2 focus:ring-chat-user"
                  disabled={uploading}
                >
                  <option value="public">Public</option>
                  <option value="employee">Employee</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={uploading || !docFile}
                className="w-full px-4 py-3 rounded-lg bg-chat-user text-white font-medium hover:bg-chat-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? "Uploading..." : "Upload Document"}
              </button>
            </form>
          </div>
        )}

        {/* Status Message */}
        {uploadStatus && (
          <div
            className={`mt-4 p-4 rounded-lg ${
              uploadStatus.type === "success"
                ? "bg-green-500/20 border border-green-500/50 text-green-400"
                : "bg-red-500/20 border border-red-500/50 text-red-400"
            }`}
          >
            {uploadStatus.message}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-surface/50 rounded-xl border border-subtle p-6">
          <h3 className="text-lg font-semibold text-white mb-3">📋 Instructions</h3>
          <div className="space-y-2 text-sm text-chat-text-secondary">
            <p><strong>CSV Format:</strong> question, answer, audience, category, tags</p>
            <p><strong>Supported Documents:</strong> PDF (.pdf), Word (.docx)</p>
            <p><strong>After Upload:</strong> Files are processed, chunked, and indexed in the knowledge base</p>
            <p><strong>Testing:</strong> Upload CSV, then ask questions in chat to verify</p>
          </div>
        </div>
      </div>
    </div>
  );
}
