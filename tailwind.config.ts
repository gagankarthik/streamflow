import type { Config } from "tailwindcss";

export default {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
        oxford_blue: {
          DEFAULT: 'hsl(var(--oxford-blue-500))',
          100: 'hsl(var(--oxford-blue-100))',
          200: 'hsl(var(--oxford-blue-200))',
          300: 'hsl(var(--oxford-blue-300))',
          400: 'hsl(var(--oxford-blue-400))',
          500: 'hsl(var(--oxford-blue-500))',
          600: 'hsl(var(--oxford-blue-600))',
          700: 'hsl(var(--oxford-blue-700))',
          800: 'hsl(var(--oxford-blue-800))',
          900: 'hsl(var(--oxford-blue-900))',
        },
        prussian_blue: {
          DEFAULT: 'hsl(var(--prussian-blue-500))',
          100: 'hsl(var(--prussian-blue-100))',
          200: 'hsl(var(--prussian-blue-200))',
          300: 'hsl(var(--prussian-blue-300))',
          400: 'hsl(var(--prussian-blue-400))',
          500: 'hsl(var(--prussian-blue-500))',
          600: 'hsl(var(--prussian-blue-600))',
          700: 'hsl(var(--prussian-blue-700))',
          800: 'hsl(var(--prussian-blue-800))',
          900: 'hsl(var(--prussian-blue-900))',
        },
        cambridge_blue: {
          DEFAULT: 'hsl(var(--cambridge-blue-500))',
          100: 'hsl(var(--cambridge-blue-100))',
          200: 'hsl(var(--cambridge-blue-200))',
          300: 'hsl(var(--cambridge-blue-300))',
          400: 'hsl(var(--cambridge-blue-400))',
          500: 'hsl(var(--cambridge-blue-500))',
          600: 'hsl(var(--cambridge-blue-600))',
          700: 'hsl(var(--cambridge-blue-700))',
          800: 'hsl(var(--cambridge-blue-800))',
          900: 'hsl(var(--cambridge-blue-900))',
        },
        tan: {
          DEFAULT: 'hsl(var(--tan-500))',
          100: 'hsl(var(--tan-100))',
          200: 'hsl(var(--tan-200))',
          300: 'hsl(var(--tan-300))',
          400: 'hsl(var(--tan-400))',
          500: 'hsl(var(--tan-500))',
          600: 'hsl(var(--tan-600))',
          700: 'hsl(var(--tan-700))',
          800: 'hsl(var(--tan-800))',
          900: 'hsl(var(--tan-900))',
        },
        burnt_sienna: {
          DEFAULT: 'hsl(var(--burnt-sienna-500))',
          100: 'hsl(var(--burnt-sienna-100))',
          200: 'hsl(var(--burnt-sienna-200))',
          300: 'hsl(var(--burnt-sienna-300))',
          400: 'hsl(var(--burnt-sienna-400))',
          500: 'hsl(var(--burnt-sienna-500))',
          600: 'hsl(var(--burnt-sienna-600))',
          700: 'hsl(var(--burnt-sienna-700))',
          800: 'hsl(var(--burnt-sienna-800))',
          900: 'hsl(var(--burnt-sienna-900))',
        },
        neutral_f2f2f2: 'hsl(var(--neutral-f2f2f2))', // Added new color
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
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
} satisfies Config;
