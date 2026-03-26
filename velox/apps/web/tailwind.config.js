/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        velox: {
          bg: '#0A0A0F',
          surface: '#13131A',
          'surface-hover': '#1A1A24',
          border: '#2A2A35',
          'border-light': '#3A3A48',
          accent: '#00E5CC',
          'accent-hover': '#00CCB6',
          'accent-muted': 'rgba(0, 229, 204, 0.1)',
          amber: '#F59E0B',
          'amber-muted': 'rgba(245, 158, 11, 0.1)',
          red: '#EF4444',
          'red-muted': 'rgba(239, 68, 68, 0.1)',
          green: '#22C55E',
          'green-muted': 'rgba(34, 197, 94, 0.1)',
          'text-primary': '#F0F0F5',
          'text-secondary': '#A0A0B0',
          'text-muted': '#6B6B7B',
        },
      },
      fontFamily: {
        mono: ['DM Mono', 'ui-monospace', 'monospace'],
        sans: ['Instrument Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
