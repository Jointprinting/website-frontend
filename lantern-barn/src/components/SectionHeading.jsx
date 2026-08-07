import Link from "next/link";

export default function SectionHeading({ eyebrow, title, action, href }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="text-3xl sm:text-4xl">{title}</h2>
      </div>
      {action && href && (
        <Link href={href} className="text-sm font-semibold text-clay hover:text-pine">
          {action} →
        </Link>
      )}
    </div>
  );
}
