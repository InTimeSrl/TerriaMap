import { action, runInAction } from "mobx";
import React from "react";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import CommonStrata from "terriajs/lib/Models/Definition/CommonStrata";
import createStratumInstance from "terriajs/lib/Models/Definition/createStratumInstance";
import hasTraits from "terriajs/lib/Models/Definition/hasTraits";
import ChartPointOnMapTraits from "terriajs/lib/Traits/TraitsClasses/ChartPointOnMapTraits";
import LatLonHeightTraits from "terriajs/lib/Traits/TraitsClasses/LatLonHeightTraits";
import ChartPreviewStyles from "terriajs/lib/ReactViews/Custom/Chart/chart-preview.scss";
import ChartExpandAndDownloadButtons from "terriajs/lib/ReactViews/Custom/Chart/ChartExpandAndDownloadButtons";
import Chart from "terriajs/lib/ReactViews/Custom/Chart/FeatureInfoPanelChart";
import CsvChartCustomComponent from "terriajs/lib/ReactViews/Custom/CsvChartCustomComponent";
import { ChartCustomComponentAttributes } from "terriajs/lib/ReactViews/Custom/ChartCustomComponent";

// Funzioni helper private in terriajs, replicate qui (sono poche righe stabili)
function getFeaturePosition(feature: any) {
  const cartesian = feature?.position?.getValue(JulianDate.now());
  if (cartesian) {
    const carto = Ellipsoid.WGS84.cartesianToCartographic(cartesian);
    return {
      longitude: CesiumMath.toDegrees(carto.longitude),
      latitude: CesiumMath.toDegrees(carto.latitude)
    };
  }
}

function getInsertedTitle(node: any) {
  if (
    node.parent?.name === "td" &&
    node.parent.parent?.name === "tr" &&
    node.parent.parent.children?.[0]?.children?.[0]
  ) {
    return node.parent.parent.children[0].children[0].data;
  }
}

interface Attrs extends ChartCustomComponentAttributes {
  hidePreviewChart?: boolean;
}

export default class ChartCustomComponentNoPreview extends CsvChartCustomComponent {
  get attributes() {
    return super.attributes.concat(["hide-preview-chart"]);
  }

  processNode(context: any, node: any, children: any[], index: number) {
    // Tutto ciò che non è il tag <chart> diretto (es. sintassi a tabella)
    // continua a passare dall'implementazione originale di terriajs.
    if (node.name !== this.name) {
      return super.processNode(context, node, children, index);
    }

    if (
      node.attribs === undefined ||
      !context.terria ||
      !context.feature ||
      !context.catalogItem
    ) {
      return undefined;
    }

    const featurePosition = getFeaturePosition(context.feature);
    const attrs: Attrs = this.parseNodeAttrs(node.attribs);
    attrs.hidePreviewChart = node.attribs["hide-preview-chart"] === "true";

    const child = children[0];
    const body: string | undefined = typeof child === "string" ? child : undefined;
    const chartElements: React.ReactElement[] = [];
    (this as any).chartItemId = (this as any).chartItemId ?? createGuid();

    if (
      attrs.downloads === undefined &&
      body &&
      (this as any).constructDownloadUrlFromBody !== undefined
    ) {
      attrs.downloads = [(this as any).constructDownloadUrlFromBody(body)];
    }

    // --- Bottoni Expand/Download: logica invariata rispetto a terriajs ---
    if (!attrs.hideButtons) {
      const sourceItems = (attrs.downloads || attrs.sources || [""]).map(
        (source: string, i: number) => {
          const id = `${context.catalogItem!.uniqueId}:${attrs.title}:${source}`;
          const itemOrPromise = (this as any).constructShareableCatalogItem
            ? (this as any).constructShareableCatalogItem(id, context, undefined)
            : (this as any).constructCatalogItem(id, context, undefined);
          return Promise.resolve(itemOrPromise).then(
            action((item: any) => {
              if (item) {
                (this as any).setTraitsFromParent(item, context.catalogItem!);
                (this as any).setTraitsFromAttrs(item, attrs, i);
                body && (this as any).setTraitsFromBody?.(item, body);
                if (
                  featurePosition &&
                  hasTraits(item, ChartPointOnMapTraits, "chartPointOnMap")
                ) {
                  item.setTrait(
                    CommonStrata.user,
                    "chartPointOnMap",
                    createStratumInstance(LatLonHeightTraits, featurePosition)
                  );
                }
              }
              return item;
            })
          );
        }
      );

      chartElements.push(
        React.createElement(ChartExpandAndDownloadButtons, {
          key: "button",
          terria: context.terria,
          sourceItems,
          sourceNames: attrs.sourceNames,
          canDownload: attrs.canDownload === true,
          downloads: attrs.downloads,
          downloadNames: attrs.downloadNames,
          raiseToTitle: !!getInsertedTitle(node)
        })
      );
    }

    // --- Grafico inline: SOLO se non è nascosto per questo tag ---
    if (!attrs.hidePreviewChart) {
      const chartItem = (this as any).constructCatalogItem(
        (this as any).chartItemId,
        context,
        undefined
      );
      if (chartItem) {
        runInAction(() => {
          (this as any).setTraitsFromParent(chartItem, context.catalogItem!);
          (this as any).setTraitsFromAttrs(chartItem, attrs, 0);
          body && (this as any).setTraitsFromBody?.(chartItem, body);
        });

        chartElements.push(
          React.createElement(Chart, {
            key: "chart",
            terria: context.terria,
            item: chartItem,
            xAxisLabel: attrs.previewXLabel,
            height: 110
          })
        );
      }
    }

    return React.createElement(
      "div",
      { key: "chart-wrapper", className: ChartPreviewStyles.previewChartWrapper },
      chartElements
    );
  }
}