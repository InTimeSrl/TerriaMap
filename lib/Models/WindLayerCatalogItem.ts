import { computed, makeObservable, observable, override, runInAction } from "mobx";
import { WindData, WindLayer } from "cesium-wind-layer";
import CatalogMemberMixin from "terriajs/lib/ModelMixins/CatalogMemberMixin";
import MappableMixin, { MapItem } from "terriajs/lib/ModelMixins/MappableMixin";
import TerriaError from "terriajs/lib/Core/TerriaError";
import CatalogMemberFactory from "terriajs/lib/Models/Catalog/CatalogMemberFactory";
import CreateModel from "terriajs/lib/Models/Definition/CreateModel";
import { ModelConstructorParameters } from "terriajs/lib/Models/Definition/Model";
import WindLayerCatalogItemTraits from "./WindLayerCatalogItemTraits";
import {
  CesiumViewerLike,
  ConfiguredWindLayer,
  fetchWindFieldPayload,
  getConfiguredWindLayer,
  getWindLayerOptions,
  normalizeWindData,
  waitForCesiumViewer
} from "../Core/initializeWindLayers";

export default class WindLayerCatalogItem extends MappableMixin(
  CatalogMemberMixin(CreateModel(WindLayerCatalogItemTraits))
) {
  static readonly type = "wind-layer";

  @observable private windConfig: ConfiguredWindLayer | undefined;
  @observable private windData: WindData | undefined;
  @observable private cesiumViewer: CesiumViewerLike | undefined;
  @observable.ref private windLayer: WindLayer | undefined;

  constructor(...args: ModelConstructorParameters) {
    super(...args);
    makeObservable(this);
  }

  get type() {
    return WindLayerCatalogItem.type;
  }

  @override
  get disableZoomTo() {
    return true;
  }

  protected async forceLoadMapItems(): Promise<void> {
    const windConfig = getConfiguredWindLayer(this.terria, this.layerId);
    const [viewer, payload] = await Promise.all([
      waitForCesiumViewer(this.terria),
      fetchWindFieldPayload(
        windConfig.url,
        windConfig.name ?? windConfig.id ?? this.layerId ?? this.uniqueId
      )
    ]);

    runInAction(() => {
      this.cesiumViewer = viewer;
      this.windConfig = windConfig;
      this.windData = normalizeWindData(payload);
    });
  }

  @computed
  get mapItems(): MapItem[] {
    if (
      this.isLoadingMapItems ||
      !this.show ||
      this.windConfig === undefined ||
      this.windData === undefined ||
      this.cesiumViewer === undefined
    ) {
      this.destroyWindLayer();
      return [];
    }

    if (!this.windLayer) {
      this.windLayer = new WindLayer(
        this.cesiumViewer,
        this.windData,
        getWindLayerOptions(this.windConfig)
      );

      if (this.windConfig.zoomOnLoad) {
        this.windLayer.zoomTo(this.windConfig.zoomDuration ?? 0);
      }
    } else {
      this.windLayer.show = true;
    }

    return [];
  }

  dispose() {
    this.destroyWindLayer();
    super.dispose();
  }

  private destroyWindLayer() {
    if (this.windLayer && !this.windLayer.isDestroyed()) {
      this.windLayer.destroy();
    }

    this.windLayer = undefined;
  }
}

CatalogMemberFactory.register(WindLayerCatalogItem.type, WindLayerCatalogItem);