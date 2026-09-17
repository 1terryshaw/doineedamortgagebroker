import Link from "next/link";

// tap44: every control in this nav carries min-h-[44px]. px-4 py-2 on text-sm rendered
// 38px tall (20px line-box + 16px padding + 2px border) — under the 40px Site Surfer
// floor and under the 44px fleet standard (Site Surfer 2026-09-16, /directory @390).
// The disabled <span>s get it too, so the row keeps one baseline height.

type Props = {
  currentPage: number;
  hasMore: boolean;
  basePath: string;
  searchParams?: Record<string, string>;
};

export default function Pagination({
  currentPage,
  hasMore,
  basePath,
  searchParams = {},
}: Props) {
  if (currentPage === 1 && !hasMore) return null;

  const buildHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") params.set(k, v);
    }
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-between border-t border-gray-200 pt-6"
    >
      <div className="flex-1">
        {currentPage > 1 ? (
          <Link
            href={buildHref(currentPage - 1)}
            className="inline-flex min-h-[44px] items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Previous
          </Link>
        ) : (
          <span className="inline-flex min-h-[44px] items-center rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400">
            ← Previous
          </span>
        )}
      </div>
      <div className="text-sm text-gray-600">Page {currentPage}</div>
      <div className="flex-1 text-right">
        {hasMore ? (
          <Link
            href={buildHref(currentPage + 1)}
            className="inline-flex min-h-[44px] items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Next →
          </Link>
        ) : (
          <span className="inline-flex min-h-[44px] items-center rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400">
            Next →
          </span>
        )}
      </div>
    </nav>
  );
}
