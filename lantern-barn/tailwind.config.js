/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Warm Vermont / river / coffee palette
        cream: "#FAF5EC",
        sand: "#F0E7D6",
        pine: "#2E4636", // deep barn-forest green (primary)
        moss: "#5B7355",
        river: "#6E8CA0", // Ottauquechee slate-blue
        lantern: "#E0A458", // warm amber glow (accent / CTA)
        clay: "#B5613B", // terracotta
        ink: "#2A2622", // near-black warm text
      },
      fontFamily: {
        // Wired up via next/font in layout.jsx
        display: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      maxWidth: {
        prose: "68ch",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        soft: "0 10px 40px -12px rgba(46, 70, 54, 0.25)",
      },
    },
  },
  plugins: [],
};
