import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 — This page is closed",
};

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <p className="text-lg text-muted">404</p>
      <h1 className="verdict font-extrabold" style={{ color: "#dc2626" }}>
        NO.
      </h1>
      <p className="mt-6 max-w-xl text-xl italic text-muted">
        {"This page is closed. Unlike the strait, that's not up for debate."}
      </p>
      <Link
        href="/"
        className="mt-10 rounded-full border border-line px-5 py-2 text-sm font-medium transition-colors hover:bg-surface"
      >
        Back to the strait →
      </Link>
    </main>
  );
}
