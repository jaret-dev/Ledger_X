/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    // Override (not extend) so engineers reach for design-system tokens
    // instead of stock Tailwind palette names. Anything genuinely missing
    // can be added under `extend` below.
    colors: {
      transparent: "transparent",
      current: "currentColor",
      bg: "var(--bg)",
      "bg-2": "var(--bg-2)",
      card: "var(--card)",
      ink: "var(--ink)",
      "ink-2": "var(--ink-2)",
      "ink-3": "var(--ink-3)",
      line: "var(--line)",
      "line-2": "var(--line-2)",
      accent: "var(--accent)",
      "accent-2": "var(--accent-2)",
      "accent-3": "var(--accent-3)",
      "accent-4": "var(--accent-4)",
      "accent-5": "var(--accent-5)",
      danger: "var(--danger)",
      success: "var(--success)",
      // White is required for the rare component that needs a hard white
      // (icons on dark backgrounds, etc.) — keep but discourage.
      white: "#ffffff",
      black: "#000000",
    },
    fontFamily: {
      sans: ['"Inter Tight"', "system-ui", "-apple-system", "sans-serif"],
      serif: ['"Fraunces"', "Georgia", "serif"],
      mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
    },
    borderRadius: {
      none: "0",
      DEFAULT: "var(--radius)", // 2px
      sm: "1px",
      md: "4px",
      lg: "8px",
      full: "9999px",
    },
    extend: {
      fontSize: {
        // Stat numbers and the topbar h1 from the mockup — handy to have
        // as utilities in case a component needs them outside a heading.
        stat: ["32px", { lineHeight: "1", letterSpacing: "-0.5px" }],
        hero: ["42px", { lineHeight: "1", letterSpacing: "-1px" }],
      },
      maxWidth: {
        main: "1400px", // mockup's main content max-width
      },
      screens: {
        // Mockup breakpoint — sidebar collapses below this.
        mobile: { max: "900px" },
      },
    },
  },
  plugins: [],
};
