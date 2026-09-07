import {
  computed,
  IReactionDisposer,
  makeObservable,
  observable,
  override,
  reaction,
  runInAction
} from "mobx";
import { WindData, WindLayer } from "cesium-wind-layer";
import CatalogMemberMixin from "terriajs/lib/ModelMixins/CatalogMemberMixin";
import MappableMixin, { MapItem } from "terriajs/lib/ModelMixins/MappableMixin";
import CatalogMemberFactory from "terriajs/lib/Models/Catalog/CatalogMemberFactory";
import CreateModel from "terriajs/lib/Models/Definition/CreateModel";
import { ModelConstructorParameters } from "terriajs/lib/Models/Definition/Model";
import WindLayerCatalogItemTraits from "./WindLayerCatalogItemTraits";
import {
  CesiumViewerLike,
  ConfiguredWindLayer,
  fetchWindFieldPayload,
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
  private readonly disposeShowReaction: IReactionDisposer;

  constructor(...args: ModelConstructorParameters) {
    super(...args);
    makeObservable(this);

    this.disposeShowReaction = reaction(
      () => this.show,
      (show) => {
        if (this.windLayer) {
          this.windLayer.show = show;
        }
      }
    );
  }

  get type() {
    return WindLayerCatalogItem.type;
  }

  @override
  get disableZoomTo() {
    return true;
  }

  protected async forceLoadMapItems(): Promise<void> {
    if (!this.url) {
      throw new Error("A wind-layer catalog item requires a url property.");
    }

    const windConfig: ConfiguredWindLayer = {
      id: this.uniqueId,
      name: this.name,
      url: this.url,
      zoomOnLoad: this.zoomOnLoad,
      zoomDuration: this.zoomDuration,
      options: this.options as ConfiguredWindLayer["options"]
    };

    const [viewer, payload] = await Promise.all([
      waitForCesiumViewer(this.terria),
      fetchWindFieldPayload(
        windConfig.url,
        windConfig.name ?? windConfig.id ?? this.uniqueId
      )
    ]);

    const windData = normalizeWindData(payload);
    const existingLayer = this.windLayer;
    const windLayer = new WindLayer(
      viewer,
      windData,
      getWindLayerOptions(windConfig)
    );
    windLayer.show = this.show;

    runInAction(() => {
      if (existingLayer && !existingLayer.isDestroyed()) {
        existingLayer.destroy();
      }

      this.cesiumViewer = viewer;
      this.windConfig = windConfig;
      this.windData = windData;
      this.windLayer = windLayer;
    });

    if (windConfig.zoomOnLoad) {
      windLayer.zoomTo(windConfig.zoomDuration ?? 0);
    }
  }

  @computed
  get mapItems(): MapItem[] {
    return [];
  }

  dispose() {
    this.disposeShowReaction();
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