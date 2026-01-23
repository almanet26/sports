module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,html}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Roboto Mono', 'Courier New', 'monospace'],
      },
      colors: {
        // Custom dark theme colors matching reference
        dark: {
          900: '#070A14',
          800: '#0A0F1C', 
          700: '#0D1117',
          600: '#0B1020',
        },
      },
      backgroundImage: {
        'gradient-dark': 'linear-gradient(135deg, #070A14 0%, #0A0F1C 50%, #0D1117 100%)',
        'gradient-primary': 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
        'gradient-text': 'linear-gradient(135deg, #60A5FA 0%, #A78BFA 50%, #F472B6 100%)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'spin-slow': 'spin 50s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(96, 165, 250, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(96, 165, 250, 0.6)' },
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
