import Link from "next/link";

export default function NotFound() {
  return (
    <section className="container-x flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow mb-3">Lost on the river</p>
      <h1 className="text-4xl sm:text-5xl">We couldn't find that page</h1>
      <p className="mt-4 max-w-md text-lg text-ink/70">
        It may have wandered off. Let's get you back to the barn.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">Back home</Link>
        <Link href="/events" className="btn-outline">See what's on</Link>
      </div>
    </section>
  );
}
