// Simple placeholder lantern mark. The client plans to replace the logo —
// swap this SVG (or drop in an <Image>) when the final mark is ready.
export default function Logo({ className = "h-8 w-8" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      {/* handle */}
      <path d="M11 6.5c0-2 1.8-3.5 5-3.5s5 1.5 5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {/* top cap */}
      <path d="M9.5 8.5h13l-1.2 2.2H10.7L9.5 8.5Z" fill="currentColor" />
      {/* body */}
      <rect x="10.3" y="10.7" width="11.4" height="14" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
      {/* flame / glow */}
      <path d="M16 13.6c1.8 1.2 2.7 2.6 2.7 4.2A2.7 2.7 0 0 1 16 20.5a2.7 2.7 0 0 1-2.7-2.7c0-1.6.9-3 2.7-4.2Z" fill="currentColor" />
      {/* base */}
      <path d="M11.5 24.7h9l-1 3.3a1 1 0 0 1-1 .7h-5a1 1 0 0 1-1-.7l-1-3.3Z" fill="currentColor" />
    </svg>
  );
}
