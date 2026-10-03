import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="shell py-24">
      <div className="card dotgrid max-w-lg mx-auto p-10 text-center space-y-5">
        <p className="num text-6xl font-semibold text-lime">404</p>
        <h1 className="text-2xl font-bold text-fg">This page doesn&apos;t exist</h1>
        <p className="text-sm text-dim">The link may be broken, or the page was moved.</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link href="/explore" className="btn-primary">
            Explore challenges
          </Link>
          <Link href="/" className="btn-secondary">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
