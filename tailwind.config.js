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
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			sans: [
  				'var(--font-overpass)',
  				'sans-serif'
  			]
  		},
  		colors: {
  			pantonered: {
  				'50': '#ffffff',
  				'100': '#fad7da',
  				'200': '#f5b0b5',
  				'300': '#f08890',
  				'400': '#eb616b',
  				'500': '#e63946',
  				'600': '#b82e38',
  				'700': '#8a222a',
  				'800': '#5c171c',
  				'900': '#2e0b0e',
  				'950': '#000000',
  				DEFAULT: '#e63946'
  			},
  			honeydew: {
  				'50': '#ffffff',
  				'100': '#fcfefc',
  				'200': '#f9fdf8',
  				'300': '#f7fcf5',
  				'400': '#f4fbf1',
  				'500': '#f1faee',
  				'600': '#c1c8be',
  				'700': '#91968f',
  				'800': '#60645f',
  				'900': '#303230',
  				'950': '#000000',
  				DEFAULT: '#f1faee'
  			},
  			nonphotoblue: {
  				'50': '#ffffff',
  				'100': '#eef8f8',
  				'200': '#dcf0f1',
  				'300': '#cbe9ea',
  				'400': '#b9e1e3',
  				'500': '#a8dadc',
  				'600': '#86aeb0',
  				'700': '#658384',
  				'800': '#435758',
  				'900': '#222c2c',
  				'950': '#000000',
  				DEFAULT: '#a8dadc'
  			},
  			cerulean: {
  				'50': '#ffffff',
  				'100': '#dae5eb',
  				'200': '#b5cad8',
  				'300': '#8fb0c4',
  				'400': '#6a95b1',
  				'500': '#457b9d',
  				'600': '#37627e',
  				'700': '#294a5e',
  				'800': '#1c313f',
  				'900': '#0e191f',
  				'950': '#000000',
  				DEFAULT: '#457b9d'
  			},
  			berkeleyblue: {
  				'50': '#ffffff',
  				'100': '#d2d7dd',
  				'200': '#a5aebc',
  				'300': '#77869a',
  				'400': '#4a5d79',
  				'500': '#1d3557',
  				'600': '#172a46',
  				'700': '#112034',
  				'800': '#0c1523',
  				'900': '#060b11',
  				'950': '#000000',
  				DEFAULT: '#1d3557'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}