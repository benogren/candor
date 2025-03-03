/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-roboto)', 'sans-serif'], // Set Roboto as default
      },
      colors: {
        pantonered: {
          '900': '#33060a',
          '800': '#660d14',
          '700': '#99131e',
          '600': '#cb1928',
          '500': '#e63946',
          '400': '#eb5f6b',
          '300': '#f08790',
          '200': '#f5afb5',
          '100': '#fad7da',
          DEFAULT: '#e63946'
        },
        honeydew: {
            '900': '#234c16',
            '800': '#47982c',
            '700': '#75ce57',
            '600': '#b4e4a3',
            '500': '#f1faee',
            '400': '#f5fbf2',
            '300': '#f7fcf6',
            '200': '#fafdf9',
            '100': '#fcfefc',
            DEFAULT: '#f1faee'
        },
        nonphotoblue: {
            '900': '#163637',
            '800': '#2c6d6f',
            '700': '#42a3a6',
            '600': '#70c3c6',
            '500': '#a8dadc',
            '400': '#b9e2e3',
            '300': '#cae9ea',
            '200': '#dcf0f1',
            '100': '#edf8f8',
            DEFAULT: '#a8dadc'
        },
        cerulean: {
            '900': '#0e181f',
            '800': '#1b313e',
            '700': '#29495e',
            '600': '#37627d',
            '500': '#457b9d',
            '400': '#6097b9',
            '300': '#88b1cb',
            '200': '#b0cbdc',
            '100': '#d7e5ee',
            DEFAULT: '#457b9d'
        },
        berkeleyblue: {
            '900': '#060b12',
            '800': '#0c1623',
            '700': '#122035',
            '600': '#172b46',
            '500': '#1d3557',
            '400': '#315a93',
            '300': '#4e7fc4',
            '200': '#89aad8',
            '100': '#c4d4eb',
            DEFAULT: '#1d3557'
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}