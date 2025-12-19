/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium SaaS color palette
        "chat-bg": "#1f1f23",
        "chat-sidebar": "#171719",
        "chat-sidebar-hover": "#252528",
        "chat-border": "rgba(255, 255, 255, 0.08)",
        "chat-user": "#10a37f",
        "chat-assistant": "#2a2a2e",
        "chat-input": "#252528",
        "chat-input-border": "rgba(255, 255, 255, 0.1)",
        "chat-text-primary": "#ececf1",
        "chat-text-secondary": "#9ca3af",
        "chat-text-muted": "#6b7280",
        "chat-accent": "#10a37f",
        "chat-accent-hover": "#0d8f6e",
        // Premium surface colors
        "surface": "#252528",
        "surface-hover": "#2d2d30",
        "subtle": "rgba(255, 255, 255, 0.06)",
        "border-light": "rgba(255, 255, 255, 0.1)",
        "border-medium": "rgba(255, 255, 255, 0.12)",
      },
      spacing: {
        "sidebar": "260px",
        "chat-max": "768px",
      },
      maxWidth: {
        "chat": "768px",
        "chat-wide": "896px",
      },
      boxShadow: {
        "chat-input": "0 0 0 1px rgba(255, 255, 255, 0.1)",
        "chat-input-focus": "0 0 0 2px rgba(16, 163, 127, 0.5)",
        "premium-card": "0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        "premium-button": "0 4px 12px rgba(16, 163, 127, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)",
        "premium-button-hover": "0 6px 16px rgba(16, 163, 127, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3)",
        "premium-input-focus": "0 0 0 3px rgba(16, 163, 127, 0.15), 0 0 0 1px rgba(16, 163, 127, 0.5)",
        "sidebar-divider": "1px 0 0 rgba(255, 255, 255, 0.06)",
        "profile-card": "0 2px 8px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05)",
      },
      borderRadius: {
        "chat": "0.5rem",
        "chat-lg": "0.75rem",
      },
      fontSize: {
        "chat": "0.9375rem",
        "chat-sm": "0.875rem",
      },
      lineHeight: {
        "chat": "1.75",
      },
    },
  },
  plugins: [],
};


