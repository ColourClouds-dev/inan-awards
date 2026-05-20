/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
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
      colors: {
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
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      // ── Major Third type scale (ratio = 1.25, base = 1rem / 16px) ──────────
      // Each step multiplies by 1.25. Line heights follow the same ratio.
      // xs   = 1 / 1.25³ ≈ 0.512rem  → floored to 0.64rem for legibility
      // sm   = 1 / 1.25² = 0.64rem
      // base = 1rem
      // md   = 1.25rem
      // lg   = 1.563rem
      // xl   = 1.953rem
      // 2xl  = 2.441rem
      // 3xl  = 3.052rem
      fontSize: {
        'xs':   ['0.64rem',   { lineHeight: '1rem',     letterSpacing: '0.02em'  }],
        'sm':   ['0.8rem',    { lineHeight: '1.25rem',  letterSpacing: '0.01em'  }],
        'base': ['1rem',      { lineHeight: '1.5rem',   letterSpacing: '0'       }],
        'md':   ['1.25rem',   { lineHeight: '1.75rem',  letterSpacing: '-0.01em' }],
        'lg':   ['1.563rem',  { lineHeight: '2rem',     letterSpacing: '-0.01em' }],
        'xl':   ['1.953rem',  { lineHeight: '2.441rem', letterSpacing: '-0.02em' }],
        '2xl':  ['2.441rem',  { lineHeight: '3.052rem', letterSpacing: '-0.02em' }],
        '3xl':  ['3.052rem',  { lineHeight: '3.815rem', letterSpacing: '-0.03em' }],
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
        "slide-from-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-to-left": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-from-left": "slide-from-left 0.3s ease-out",
        "slide-to-left": "slide-to-left 0.3s ease-out",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
};
