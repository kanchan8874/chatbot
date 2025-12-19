// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/api/auth/login`,
    GOOGLE_LOGIN: `${API_BASE_URL}/api/auth/google-login`,
    VERIFY_TOKEN: `${API_BASE_URL}/api/auth/verify-token`,
    LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  },
  CHAT: {
    MESSAGE: `${API_BASE_URL}/api/chat/message`,
  },
  INGEST: {
    CSV: `${API_BASE_URL}/api/ingest/csv`,
    DOCS: `${API_BASE_URL}/api/ingest/docs`,
    WEBCRAWL: `${API_BASE_URL}/api/ingest/webcrawl`,
  },
};
