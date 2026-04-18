import type { LatLngExpression, Layer, LayerOptions } from "leaflet";

declare module "leaflet" {
  interface HeatLayerOptions extends LayerOptions {
    radius?: number;
    blur?: number;
    maxZoom?: number;
    gradient?: Record<number, string>;
    minOpacity?: number;
    max?: number;
  }

  interface HeatLayer extends Layer {
    setLatLngs(latlngs: Array<LatLngExpression | [number, number, number]>): this;
    addLatLng(latlng: LatLngExpression | [number, number, number]): this;
  }

  function heatLayer(
    latlngs: Array<LatLngExpression | [number, number, number]>,
    options?: HeatLayerOptions
  ): HeatLayer;
}

declare module "leaflet.heat" {
  import { HeatLayer, HeatLayerOptions, LatLngExpression } from "leaflet";

  function heatLayer(
    latlngs: Array<LatLngExpression | [number, number, number]>,
    options?: HeatLayerOptions
  ): HeatLayer;

  export { heatLayer };
}
