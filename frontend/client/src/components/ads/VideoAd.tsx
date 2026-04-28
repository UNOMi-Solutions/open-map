import AdSenseAd from "./AdSenseAd";
import { AD_SLOTS } from "./slots";

type VideoAdProps = {
  /** Override the slot if you want a video ad in a different placement. */
  slot?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Show "Advertisement" label above the video. */
  showLabel?: boolean;
};

/**
 * Video ad unit.
 *
 * Google AdSense delivers in-stream video creatives through "Multiplex" /
 * "In-feed" / "In-article" ad units configured in your AdSense dashboard.
 * Create the ad unit there with type "Video" or "Multiplex", paste the slot ID
 * into `VITE_ADSENSE_SLOT_VIDEO` (or `AD_SLOTS.video`), and this component
 * renders it as a fluid block that scales to its container.
 *
 * Notes:
 * - AdSense does not currently allow self-hosted video player ads (use Google
 *   Ad Manager / IMA SDK for those). For AdSense publishers, video creatives
 *   are delivered via the standard ad unit shown here.
 * - The unit will not show until AdSense has approved your site AND the ad
 *   unit's slot ID is provided.
 */
export default function VideoAd({
  slot = AD_SLOTS.video,
  className,
  style,
  showLabel = true,
}: VideoAdProps) {
  return (
    <AdSenseAd
      slot={slot}
      format="fluid"
      layoutKey="-fb+5w+4e-db+86"
      responsive
      showLabel={showLabel}
      className={className}
      wrapperStyle={style}
      style={{ display: "block", width: "100%", minHeight: 250 }}
    />
  );
}
