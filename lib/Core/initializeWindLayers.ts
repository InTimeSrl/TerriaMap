import { WindData, WindLayer, WindLayerOptions } from "cesium-wind-layer";

interface WindBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface WindComponentPayload {
  array: number[];
  min?: number;
  max?: number;
}

export interface WindFieldPayload {
  width: number;
  height: number;
  bounds: WindBounds;
  u: WindComponentPayload;
  v: WindComponentPayload;
  speed?: WindComponentPayload;
}

export interface ConfiguredWindLayer {
  id?: string;
  name?: string;
  url: string;
  show?: boolean;
  zoomOnLoad?: boolean;
  zoomDuration?: number;
  options?: Partial<WindLayerOptions>;
}

export type CesiumViewerLike = {
  scene: {
    camera: unknown;
    canvas: HTMLCanvasElement;
    globe?: unknown;
  };
  camera: {
    flyTo?: (...args: unknown[]) => void;
  };
  canvas: HTMLCanvasElement;
};

export const DEFAULT_LAYER_OPTIONS: Partial<WindLayerOptions> = {
  dynamic: true,
  useViewerBounds: true
};

const VIEWER_PATHS = [
  ["mainViewer", "viewer"],
  ["mainViewer", "_viewer"],
  ["currentViewer", "viewer"],
  ["currentViewer", "cesiumViewer"],
  ["currentViewer", "cesiumWidget"],
  ["cesium", "viewer"],
  ["cesiumViewer"]
];

function getNestedValue(root: unknown, path: string[]): unknown {
  return path.reduce<unknown>((value, segment) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    return (value as Record<string, unknown>)[segment];
  }, root);
}

function normalizeViewer(candidate: unknown): CesiumViewerLike | undefined {
  if (candidate === null || candidate === undefined) {
    return undefined;
  }

  const rawViewer = candidate as Record<string, unknown>;
  const scene = rawViewer.scene as
    | {
        camera?: unknown;
        canvas?: HTMLCanvasElement;
      }
    | undefined;
  const camera = (rawViewer.camera ?? scene?.camera) as CesiumViewerLike["camera"] | undefined;
  const canvas = (rawViewer.canvas ?? scene?.canvas) as HTMLCanvasElement | undefined;

  if (!scene || !camera || !canvas) {
    return undefined;
  }

  return {
    ...(rawViewer as object),
    scene: scene as CesiumViewerLike["scene"],
    camera,
    canvas
  } as CesiumViewerLike;
}

export function resolveCesiumViewer(
  terria: unknown
): CesiumViewerLike | undefined {
  for (const path of VIEWER_PATHS) {
    const candidate = normalizeViewer(getNestedValue(terria, path));
    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function waitForCesiumViewer(
  terria: unknown,
  attemptsLeft = 60
): Promise<CesiumViewerLike> {
  const viewer = resolveCesiumViewer(terria);
  if (viewer) {
    return viewer;
  }

  if (attemptsLeft <= 0) {
    throw new Error("Unable to resolve the Cesium viewer from Terria.");
  }

  await delay(500);
  return waitForCesiumViewer(terria, attemptsLeft - 1);
}

function normalizeComponent(
  component: WindComponentPayload,
  expectedLength: number,
  label: string
) {
  const values = new Float32Array(component.array);
  if (values.length !== expectedLength) {
    throw new Error(
      `Wind component \"${label}\" expected ${expectedLength} values, received ${values.length}.`
    );
  }

  return {
    array: values,
    min: component.min,
    max: component.max
  };
}

export function normalizeWindData(payload: WindFieldPayload): WindData {
  const expectedLength = payload.width * payload.height;

  return {
    width: payload.width,
    height: payload.height,
    bounds: payload.bounds,
    u: normalizeComponent(payload.u, expectedLength, "u"),
    v: normalizeComponent(payload.v, expectedLength, "v"),
    speed: payload.speed
      ? normalizeComponent(payload.speed, expectedLength, "speed")
      : undefined
  };
}

export async function fetchWindFieldPayload(
  url: string,
  label = url
): Promise<WindFieldPayload> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to load wind layer \"${label}\": ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as WindFieldPayload;
}

export function getWindLayerOptions(
  config: ConfiguredWindLayer
): Partial<WindLayerOptions> {
  return {
    ...DEFAULT_LAYER_OPTIONS,
    ...config.options
  };
}

export async function createWindLayer(
  viewer: CesiumViewerLike,
  config: ConfiguredWindLayer
): Promise<WindLayer> {
  const payload = await fetchWindFieldPayload(
    config.url,
    config.name ?? config.id ?? config.url
  );
  const windData = normalizeWindData(payload);
  const windLayer = new WindLayer(viewer, windData, getWindLayerOptions(config));

  if (config.show === false) {
    windLayer.show = false;
  }

  if (config.zoomOnLoad) {
    windLayer.zoomTo(config.zoomDuration ?? 0);
  }

  return windLayer;
}