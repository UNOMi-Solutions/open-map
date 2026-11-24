import type { ComponentProps, ReactNode } from "react";
import MarkerClusterGroup from "react-leaflet-cluster";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

/**
 * Screen distance at which nearby points join one bubble.
 * 20px leaves the dots stacked on each other. Leaflet's 80px default
 * pulls points in from across a wide stretch of the map. 50 is between
 * those: points that would overlap become a cluster, and a cluster stays
 * local instead of covering a whole region.
 */
export const POINT_CLUSTER_RADIUS = 50;

type MarkerCompoundProps = Omit<
  ComponentProps<typeof MarkerClusterGroup>,
  "children"
> & {
  children: ReactNode;
};

const MarkerCompound = ({
  children,
  chunkedLoading = true,
  maxClusterRadius = POINT_CLUSTER_RADIUS,
  ...options
}: MarkerCompoundProps) => (
  <MarkerClusterGroup
    chunkedLoading={chunkedLoading}
    maxClusterRadius={maxClusterRadius}
    {...options}
  >
    {children}
  </MarkerClusterGroup>
);

export default MarkerCompound;