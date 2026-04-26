/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--dos-bg)',
        panel: 'var(--dos-panel)',
        panelSoft: 'var(--dos-panel-soft)',
        border: 'var(--dos-border)',
        accent: 'var(--dos-accent)',
        text: 'var(--dos-text)',
        textMuted: 'var(--dos-text-muted)',
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(255,255,255,0.04), 0 8px 28px rgba(0,0,0,0.35)',
        m6tier1: 'var(--m6-tier1-shadow)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};
