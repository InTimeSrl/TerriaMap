import {
  anyTrait,
  CatalogMemberTraits,
  MappableTraits,
  mixTraits,
  primitiveTrait
} from "terriajs-plugin-api";

export default class WindLayerCatalogItemTraits extends mixTraits(
  MappableTraits,
  CatalogMemberTraits
) {
  @primitiveTrait({
    type: "string",
    name: "Wind field URL",
    description: "Endpoint that returns the wind field payload for cesium-wind-layer."
  })
  url?: string;

  @primitiveTrait({
    type: "boolean",
    name: "Zoom on load",
    description: "Zoom the camera to the wind field extent the first time the layer is loaded."
  })
  zoomOnLoad?: boolean;

  @primitiveTrait({
    type: "number",
    name: "Zoom duration",
    description: "Camera flight duration in seconds when zoomOnLoad is enabled."
  })
  zoomDuration?: number;

  @anyTrait({
    name: "Wind layer options",
    description: "Options passed directly to cesium-wind-layer."
  })
  options?: Record<string, unknown>;
}