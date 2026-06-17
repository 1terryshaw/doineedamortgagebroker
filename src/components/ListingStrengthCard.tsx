import Link from "next/link";
import type { ReactNode } from "react";
import type { HealthItem, ListingHealth } from "@/lib/listing-health";

/**
 * Free/seed-tier onboarding card — surfaces the listing health rubric as
 * actionable top-3 deep-links into the edit form, with the rest behind a
 * disclosure. Paid tiers continue to see HealthScore.tsx in its existing slot.
 */

const LABEL_TO_ANCHOR: Record<string, string> = {
  "Business description": "#description",
  "At least 3 photos": "#photos",
  "Services listed": "#services",
  "Service area set": "#service-area",
  "Google Business Profile linked": "#gbp",
  // No edit field for reviews; pointing at GBP is the closest contextual landing.
  "5 or more Google reviews": "#gbp",
  "Updated in the last 90 days": "",
};

type IconName =
  | "pencil"
  | "photo"
  | "list"
  | "map-pin"
  | "globe"
  | "star"
  | "refresh";

const LABEL_TO_ICON: Record<string, IconName> = {
  "Business description": "pencil",
  "At least 3 photos": "photo",
  "Services listed": "list",
  "Service area set": "map-pin",
  "Google Business Profile linked": "globe",
  "5 or more Google reviews": "star",
  "Updated in the last 90 days": "refresh",
};

// Inline SVG icons, Heroicons outline style — matches the codebase pattern
// (Header.tsx, LoadingSpinner.tsx). 24px viewBox, currentColor stroke.
const ICONS: Record<IconName, ReactNode> = {
  pencil: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.18a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
    />
  ),
  photo: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
    />
  ),
  list: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 17.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
    />
  ),
  "map-pin": (
    <>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
      />
    </>
  ),
  globe: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
    />
  ),
  star: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
    />
  ),
  refresh: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  ),
};

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

const LABEL_TO_ACTION: Record<string, string> = {
  "Business description": "Write description",
  "At least 3 photos": "Add photos",
  "Services listed": "List services",
  "Service area set": "Set service area",
  "Google Business Profile linked": "Link Google profile",
  "5 or more Google reviews": "Get more reviews",
  "Updated in the last 90 days": "Refresh listing",
};

function colorFor(pct: number): string {
  return pct >= 80 ? "#16a34a" : pct >= 50 ? "#f59e0b" : "#dc2626";
}

function subtextFor(pct: number, hasTodos: boolean): string {
  if (!hasTodos) return "Your listing is fully optimized — nice work.";
  if (pct >= 80) return "Almost there — a couple of quick wins left.";
  if (pct >= 50)
    return "You're well on your way — keep going with the quick wins below.";
  return "A complete listing gets more clicks and ranks higher. You're just getting started — quick wins below.";
}

export default function ListingStrengthCard({
  health,
  editHref = "#",
  primaryColor,
  onEdit,
}: {
  health: ListingHealth;
  editHref?: string;
  primaryColor: string;
  // When provided, the card's CTAs enter inline edit mode (scrolling to the
  // given section anchor) instead of navigating to a separate edit page. Used
  // by the mortgage in-dashboard integration (TDL #620). Falls back to
  // <Link href={editHref}> when absent (original donor behaviour).
  onEdit?: (anchor: string) => void;
}) {
  const { score, max, items } = health;
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const color = colorFor(pct);
  const todos = items
    .filter((it) => !it.met)
    .sort((a, b) => b.points - a.points);
  const top3 = todos.slice(0, 3);
  const rest = todos.slice(3);

  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="text-xl font-bold">Your listing strength</h2>
        <span className="text-2xl font-bold" style={{ color }}>
          {score}/{max}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        {subtextFor(pct, todos.length > 0)}
      </p>

      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-5">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      {top3.length > 0 && (
        <div className="space-y-3">
          {top3.map((it, idx) => (
            <ActionCard
              key={it.label}
              item={it}
              emphasized={idx === 0}
              icon={LABEL_TO_ICON[it.label] ?? "pencil"}
              actionLabel={LABEL_TO_ACTION[it.label] ?? "Edit now"}
              anchor={LABEL_TO_ANCHOR[it.label] ?? ""}
              href={`${editHref}${LABEL_TO_ANCHOR[it.label] ?? ""}`}
              primaryColor={primaryColor}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 list-none flex items-center gap-1">
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">
              ›
            </span>
            <span>
              {rest.length} more way{rest.length === 1 ? "" : "s"} to reach {max}/{max}
            </span>
          </summary>
          <ul className="mt-3 space-y-1.5 pl-4">
            {rest.map((it) => (
              <li
                key={it.label}
                className="text-sm text-gray-700 flex gap-2 items-start"
              >
                <span aria-hidden="true" style={{ color: primaryColor }}>
                  →
                </span>
                <span className="flex-1">{it.hint}</span>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  +{it.points} pt{it.points === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {todos.length === 0 && (
        <p className="text-sm text-green-700">
          Your listing is fully optimized — nice work.
        </p>
      )}

      {todos.length > 0 && (
        <div className="mt-5">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(LABEL_TO_ANCHOR[top3[0]?.label] ?? "")}
              className="inline-block px-5 py-2.5 rounded-lg text-white text-sm font-semibold"
              style={{ backgroundColor: primaryColor }}
            >
              Complete my listing →
            </button>
          ) : (
            <Link
              href={editHref}
              className="inline-block px-5 py-2.5 rounded-lg text-white text-sm font-semibold"
              style={{ backgroundColor: primaryColor }}
            >
              Complete my listing →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function ActionCard({
  item,
  emphasized,
  icon,
  actionLabel,
  href,
  anchor,
  primaryColor,
  onEdit,
}: {
  item: HealthItem;
  emphasized: boolean;
  icon: IconName;
  actionLabel: string;
  href: string;
  anchor: string;
  primaryColor: string;
  onEdit?: (anchor: string) => void;
}) {
  const emphasizedCls = emphasized
    ? "inline-block px-3 py-1.5 rounded-md text-white text-xs font-semibold"
    : "inline-block text-sm font-medium hover:underline";
  const emphasizedStyle = emphasized
    ? { backgroundColor: primaryColor }
    : { color: primaryColor };
  return (
    <div
      className={`rounded-lg p-4 border-2 ${emphasized ? "" : "border-gray-200"}`}
      style={emphasized ? { borderColor: primaryColor } : undefined}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0"
          style={{
            backgroundColor: emphasized ? primaryColor : "#f3f4f6",
            color: emphasized ? "#ffffff" : primaryColor,
          }}
        >
          <Icon name={icon} className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{item.label}</p>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              +{item.points} pt{item.points === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">{item.hint}</p>
          <div className="mt-3">
            {onEdit ? (
              <button type="button" onClick={() => onEdit(anchor)} className={emphasizedCls} style={emphasizedStyle}>
                {actionLabel} →
              </button>
            ) : (
              <Link href={href} className={emphasizedCls} style={emphasizedStyle}>
                {actionLabel} →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
