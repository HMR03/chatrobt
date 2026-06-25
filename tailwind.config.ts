import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // App-specific palette
        "app-dark": "#1a1a2e",
        "app-darker": "#16162a",
        "app-sidebar": "#16213e",
        "app-surface": "#1e293b",
        "app-surface-hover": "#334155",
        "app-border": "#334155",
        "app-text": "#f1f5f9",
        "app-text-secondary": "#94a3b8",
        "app-text-muted": "#64748b",
        "app-accent": "#3b82f6",
        "app-accent-hover": "#2563eb",
        "app-user-bubble": "#3b82f6",
        "app-ai-bubble": "#1e293b",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
