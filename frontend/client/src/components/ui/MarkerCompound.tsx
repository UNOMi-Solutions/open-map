import type { ComponentProps, ReactNode } from "react";
import MarkerClusterGroup from "react-leaflet-cluster";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

type MarkerCompoundProps = Omit<
  ComponentProps<typeof MarkerClusterGroup>,
  "children"
> & {
  children: ReactNode;
};

const MarkerCompound = ({
  children,
  chunkedLoading = true,
  ...options
}: MarkerCompoundProps) => (
  <MarkerClusterGroup chunkedLoading={chunkedLoading} {...options}>
    {children}
  </MarkerClusterGroup>
);

export default MarkerCompound;