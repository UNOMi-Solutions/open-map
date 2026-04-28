import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_CLIENT =
  (import.meta as any).env?.VITE_ADSENSE_CLIENT ?? "ca-pub-4397282403486242";

type AdFormat =
  | "auto"
  | "fluid"
  | "rectangle"
  | "horizontal"
  | "vertical"
  | "autorelaxed";

type AdSenseAdProps = {
  /** AdSense ad slot ID (created in AdSense → Ads → By ad unit). */
  slot: string;
  /** Layout format. "auto" works for most placements. */
  format?: AdFormat;
  /** Layout key for In-feed / In-article ad units (provided by AdSense). */
  layoutKey?: string;
  /** Named layout for In-article ads ("in-article"). */
  layout?: string;
  /** When true, the ad becomes fully responsive. */
  responsive?: boolean;
  /** Optional inline style for the <ins> element. */
  style?: React.CSSProperties;
  /** Wrapper class for layout / spacing. */
  className?: string;
  /** Wrapper inline style. */
  wrapperStyle?: React.CSSProperties;
  /** Optional label rendered above the ad ("Advertisement"). Off by default. */
  showLabel?: boolean;
};

/**
 * Single source of truth for rendering Google AdSense units.
 *
 * Loader script is injected once in `index.html`. This component renders an
 * <ins class="adsbygoogle"> tag and pushes a request into the `adsbygoogle`
 * queue so AdSense fills it. Safe across re-mounts (StrictMode, route changes)
 * because we guard with a ref.
 */
export default function AdSenseAd({
  slot,
  format = "auto",
  layoutKey,
  layout,
  responsive = true,
  style,
  className,
  wrapperStyle,
  showLabel = false,
}: AdSenseAdProps) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    if (typeof window === "undefined") return;
    if (!ADSENSE_CLIENT) return;
    if (!slot) return;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      pushed.current = true;
    } catch (err) {
      console.warn("[AdSense] push failed", err);
    }
  }, [slot]);

  if (!slot) return null;

  return (
    <div className={className} style={wrapperStyle}>
      {showLabel && (
        <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1 text-center">
          Advertisement
        </div>
      )}
      <ins
        className="adsbygoogle"
        style={{ display: "block", ...style }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-ad-layout={layout}
        data-ad-layout-key={layoutKey}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}
