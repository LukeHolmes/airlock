/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
    "./src/main/**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        // Airlock Design System
        obsidian: {
          DEFAULT: '#08090B',
          surface: {
            1: '#0C0E11',
            2: '#12151A',
            3: '#181C22',
            4: '#20242C',
          },
        },
        line: {
          DEFAULT: '#23272F',
          strong: '#333944',
        },
        text: {
          primary: '#ECEFF3',
          secondary: '#AAB3BE',
          muted: '#7E8B9A',
          disabled: '#474E58',
        },
        ice: {
          cyan: '#3DE8D4',
          ghost: 'rgba(61, 232, 212, 0.05)',
        },
        hazard: {
          orange: '#FF6A2B',
          ghost: 'rgba(255, 106, 43, 0.05)',
        },
        threat: {
          red: '#F23D3D',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        display: ['Space Grotesk', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 0.6s linear forwards',
      },
      keyframes: {
        scan: {
          '0%': { top: '0%', opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
