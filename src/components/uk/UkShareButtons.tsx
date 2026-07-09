"use client";

// Self-contained share row for the /uk subtree. Recreated with inline SVGs so it does
// NOT depend on lucide-react (not a dependency of this repo, unlike the accountant repo
// where the shared pizzazz/ShareButtons lives).
import { useState, useCallback } from "react";

interface ShareButtonsProps {
  url?: string;
  title: string;
  description?: string;
  variant?: "compact" | "full";
}

function Icon({ d, size }: { d: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const LINK_ICON =
  "M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5";
const MAIL_ICON = "M4 4h16v16H4z M22 6l-10 7L2 6";
const SHARE_ICON =
  "M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8 M16 6l-4-4-4 4 M12 2v13";

export default function UkShareButtons({
  url,
  title,
  description,
  variant = "full",
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl =
    url || (typeof window !== "undefined" ? window.location.href : "");
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDesc = encodeURIComponent(description || title);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [shareUrl]);

  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({ title, text: description || title, url: shareUrl });
    } catch {
      // cancelled or unsupported
    }
  }, [title, description, shareUrl]);

  const compact = variant === "compact";
  const btnBase = compact
    ? "inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-gray-700 transition-colors duration-150"
    : "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 hover:text-gray-800 transition-colors duration-150";
  const iconSize = compact ? 16 : 18;

  const hasNativeShare =
    typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasNativeShare && (
        <button onClick={handleNativeShare} className={btnBase} aria-label="Share">
          <Icon d={SHARE_ICON} size={iconSize} />
          {!compact && <span>Share</span>}
        </button>
      )}
      <button onClick={handleCopy} className={btnBase} aria-label="Copy link">
        <Icon d={LINK_ICON} size={iconSize} />
        {!compact && <span>{copied ? "Copied!" : "Copy link"}</span>}
      </button>
      <a
        href={`mailto:?subject=${encodedTitle}&body=${encodedDesc}%0A%0A${encodedUrl}`}
        className={btnBase}
        aria-label="Email"
      >
        <Icon d={MAIL_ICON} size={iconSize} />
        {!compact && <span>Email</span>}
      </a>
    </div>
  );
}
