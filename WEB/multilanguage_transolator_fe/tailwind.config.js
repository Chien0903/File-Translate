module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
      extend: {
        keyframes: {
          'loading-bar': {
            '0%': { backgroundPosition: '200% 0' },
            '100%': { backgroundPosition: '-200% 0' }
          }
        },
        animation: {
          'loading-bar': 'loading-bar 1.5s ease-in-out infinite'
        }
      },
    },
    plugins: [],
  };
  