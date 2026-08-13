"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Unsplash URLs occasionally 404 or get rate-limited. Rather than showing a
 * broken image the card falls back to a deterministic warm gradient with the
 * dish initials — the grid never looks broken during a client demo.
 */
export function SafeImage({
  src,
  alt,
  className,
  wrapperClassName,
  sizes,
  priority,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  const show = src && !failed;

  const hue = React.useMemo(() => {
    let h = 0;
    for (let i = 0; i < alt.length; i++) h = (h * 31 + alt.charCodeAt(i)) % 360;
    return h;
  }, [alt]);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-cream-300",
        wrapperClassName,
      )}
    >
      {show ? (
        // Plain <img>: the demo points at remote Unsplash URLs and we want the
        // error event, which next/image swallows behind its optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className={cn("size-full object-cover", className)}
        />
      ) : (
        <div
          className="grid size-full place-items-center"
          style={{
            background: `linear-gradient(135deg, hsl(${hue} 34% 82%), hsl(${(hue + 40) % 360} 42% 68%))`,
          }}
          aria-hidden
        >
          <span className="font-display text-2xl text-white/90 drop-shadow-sm">
            {alt
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")}
          </span>
        </div>
      )}
    </div>
  );
}
