import {
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
    name: "Wind layer config id",
    description:
      "Identifier of the wind layer definition stored in config.json parameters.windLayers."
  })
  layerId?: string;
}