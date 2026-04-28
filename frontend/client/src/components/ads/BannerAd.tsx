import AdSenseAd from "./AdSenseAd";
import { AD_SLOTS } from "./slots";

type BannerAdProps = {
  /** Override the slot if you want a banner that isn't the default top/bottom one. */
  slot?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Show "Advertisement" label above the banner. */
  showLabel?: boolean;
};

/**
 * Standard responsive display banner. Renders as a horizontal banner on
 * desktop and shrinks down on mobile (Google decides exact shape because of
 * `data-ad-format="auto"` + `data-full-width-responsive="true"`).
 */
export default function BannerAd({
  slot = AD_SLOTS.banner,
  className,
  style,
  showLabel = false,
}: BannerAdProps) {
  return (
    <AdSenseAd
      slot={slot}
      format="auto"
      responsive
      showLabel={showLabel}
      className={className}
      wrapperStyle={style}
      style={{ display: "block", width: "100%", minHeight: 90 }}
    />
  );
}
