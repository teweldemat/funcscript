import {
  DefaultFsDataProvider,
  Engine,
  FSDataType,
  FsDataProvider,
  FsError,
  FsList,
  KeyValueCollection,
  type TypedValue
} from '@tewelde/funcscript/browser';

export type PrimitiveType = 'line' | 'rect' | 'circle' | 'polygon' | 'text';

export type Primitive = {
  type: PrimitiveType | string;
  data: Record<string, unknown>;
};

export type PrimitiveLayer = Primitive[];

export type ViewExtent = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type PreparedLine = {
  type: 'line';
  from: [number, number];
  to: [number, number];
  stroke: string;
  width: number;
  dash: number[] | null;
};

export type PreparedRect = {
  type: 'rect';
  position: [number, number];
  size: [number, number];
  stroke: string | null;
  fill: string | null;
  width: number;
};

export type PreparedCircle = {
  type: 'circle';
  center: [number, number];
  radius: number;
  stroke: string | null;
  fill: string | null;
  width: number;
};

export type PreparedPolygon = {
  type: 'polygon';
  points: Array<[number, number]>;
  stroke: string | null;
  fill: string | null;
  width: number;
};

export type PreparedText = {
  type: 'text';
  position: [number, number];
  text: string;
  color: string;
  fontSize: number;
  align: CanvasTextAlign;
};

export type PreparedPrimitive =
  | PreparedLine
  | PreparedRect
  | PreparedCircle
  | PreparedPolygon
  | PreparedText;

export type PreparedGraphics = {
  layers: PreparedPrimitive[][];
  warnings: string[];
};

export type EvaluationResult = {
  value: unknown;
  typed: TypedValue | null;
  error: string | null;
};

export type ViewInterpretation = {
  extent: ViewExtent | null;
  warning: string | null;
};

export type GraphicsInterpretation = {
  layers: PrimitiveLayer[] | null;
  warning: string | null;
  unknownTypes: string[];
};

export const defaultViewExpression = `{
  return { minX:-10, minY:-10, maxX:10, maxY:10 };
}`;

export const defaultGraphicsExpression = `{
  baseColor:'#38bdf8';
  accent:'#f97316';
  background:'#0f172a';
  return [
    {
      type:'rect',
      data:{
        position:[-12,-8],
        size:[24,16],
        fill:'rgba(15, 23, 42, 0.55)',
        stroke:'rgba(148, 163, 184, 0.6)',
        width:0.3
      }
    },
    {
      type:'polygon',
      data:{
        points:[[-6,-4],[0,9],[6,-4]],
        fill:'rgba(56, 189, 248, 0.45)',
        stroke:baseColor,
        width:0.4
      }
    },
    {
      type:'circle',
      data:{
        center:[4,-1],
        radius:5,
        stroke:accent,
        width:0.35
      }
    },
    {
      type:'text',
      data:{
        position:[0,-6.5],
        text:'FuncScript',
        color:'#e2e8f0',
        fontSize:1.4,
        align:'center'
      }
    }
  ];
}`;

const toPlainValue = (value: TypedValue | null): unknown => {
  if (!value) {
    return null;
  }

  const type = Engine.typeOf(value);
  const raw = Engine.valueOf(value);

  switch (type) {
    case FSDataType.Null:
    case FSDataType.Boolean:
    case FSDataType.Integer:
    case FSDataType.Float:
    case FSDataType.String:
    case FSDataType.BigInteger:
    case FSDataType.Guid:
    case FSDataType.DateTime:
      return raw;
    case FSDataType.List: {
      const list = raw as FsList;
      const entries: unknown[] = [];
      const toArray = (list as unknown as { toArray?: () => TypedValue[] }).toArray;
      if (list && typeof toArray === 'function') {
        for (const entry of toArray.call(list)) {
          entries.push(toPlainValue(entry));
        }
        return entries;
      }
      if (typeof Symbol !== 'undefined' && Symbol.iterator in (list as object)) {
        for (const entry of list as unknown as Iterable<TypedValue>) {
          entries.push(toPlainValue(entry));
        }
        return entries;
      }
      return null;
    }
    case FSDataType.KeyValueCollection: {
      const collection = raw as KeyValueCollection;
      if (collection && typeof collection.getAll === 'function') {
        const result: Record<string, unknown> = {};
        for (const [key, typed] of collection.getAll()) {
          result[key] = toPlainValue(typed);
        }
        return result;
      }
      return raw;
    }
    case FSDataType.Error: {
      const error = raw as FsError;
      return {
        type: error?.errorType ?? 'Error',
        message: error?.errorMessage ?? 'Unknown error',
        data: error?.errorData ?? null
      };
    }
    case FSDataType.Function:
      return '[Function]';
    case FSDataType.ValRef:
      return '[ValRef]';
    case FSDataType.ValSink:
      return '[ValSink]';
    case FSDataType.SigSource:
      return '[SigSource]';
    case FSDataType.SigSink:
      return '[SigSink]';
    default:
      return raw;
  }
};

const ensureNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const ensurePoint = (value: unknown): [number, number] | null => {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }
  const [x, y] = value;
  if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
    return [x, y];
  }
  return null;
};

const ensurePoints = (value: unknown): Array<[number, number]> | null => {
  if (!Array.isArray(value) || value.length < 3) {
    return null;
  }
  const points: Array<[number, number]> = [];
  for (const entry of value) {
    const point = ensurePoint(entry);
    if (!point) {
      return null;
    }
    points.push(point);
  }
  return points;
};

export const evaluateExpression = (
  provider: FsDataProvider,
  expression: string
): EvaluationResult => {
  const trimmed = expression.trim();
  if (!trimmed) {
    return {
      value: null,
      typed: null,
      error: null
    };
  }

  try {
    const typed = Engine.evaluate(trimmed, provider);
    const value = toPlainValue(typed);
    return { value, typed, error: null };
  } catch (err) {
    return {
      value: null,
      typed: null,
      error: err instanceof Error ? err.message : String(err)
    };
  }
};

export const interpretView = (value: unknown): ViewInterpretation => {
  if (value === null || value === undefined) {
    return { extent: null, warning: 'View expression returned null. Provide numeric bounds.' };
  }
  if (Array.isArray(value) || typeof value !== 'object') {
    return { extent: null, warning: 'View expression must return { minX, minY, maxX, maxY }.' };
  }
  const record = value as Record<string, unknown>;
  const minX = ensureNumber(record.minX);
  const maxX = ensureNumber(record.maxX);
  const minY = ensureNumber(record.minY);
  const maxY = ensureNumber(record.maxY);
  if (minX === null || maxX === null || minY === null || maxY === null) {
    return {
      extent: null,
      warning: 'All extent fields must be finite numbers.'
    };
  }
  if (maxX <= minX || maxY <= minY) {
    return {
      extent: null,
      warning: 'Extent must define a positive width and height (max > min).'
    };
  }
  return {
    extent: { minX, maxX, minY, maxY },
    warning: null
  };
};

const describeError = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const collectPrimitives = (
  node: unknown,
  path: string,
  warnings: string[],
  unknownTypes: Set<string>
): Primitive[] => {
  const location = path || 'root';

  if (Array.isArray(node)) {
    const primitives: Primitive[] = [];
    node.forEach((child, index) => {
      primitives.push(...collectPrimitives(child, `${path}[${index}]`, warnings, unknownTypes));
    });
    return primitives;
  }

  if (node && typeof node === 'object') {
    const candidate = node as { type?: unknown; data?: unknown; transform?: unknown };
    let type: unknown;
    let data: unknown;
    let transform: unknown;

    try {
      ({ type, data, transform } = candidate);
    } catch (err) {
      warnings.push(`Skipping graphics entry at ${location} because it threw while reading: ${describeError(err)}.`);
      return [];
    }

    if (typeof type === 'string' && data && typeof data === 'object' && !Array.isArray(data)) {
      if (!['line', 'rect', 'circle', 'polygon', 'text'].includes(type)) {
        unknownTypes.add(type);
      }
      if (transform !== undefined && transform !== null) {
        warnings.push(
          `Primitive at ${location} includes a transform, but transforms are no longer supported and will be ignored.`
        );
      }
      return [
        {
          type,
          data: data as Record<string, unknown>
        }
      ];
    }

    warnings.push(`Primitive at ${location} must include string 'type' and object 'data'.`);
    return [];
  }

  warnings.push(`Skipping graphics entry at ${location} because it is not a list or object.`);
  return [];
};

export const interpretGraphics = (value: unknown): GraphicsInterpretation => {
  if (value === null || value === undefined) {
    return {
      layers: null,
      warning: 'Graphics expression returned null. Provide a primitive or a list of primitives.',
      unknownTypes: []
    };
  }

  const warnings: string[] = [];
  const unknown = new Set<string>();
  const layers: PrimitiveLayer[] = [];

  if (Array.isArray(value)) {
    const primitives = collectPrimitives(value, 'root', warnings, unknown);
    if (primitives.length > 0) {
      layers.push(primitives);
    }
  } else if (value && typeof value === 'object') {
    const primitives = collectPrimitives(value, 'root', warnings, unknown);
    if (primitives.length > 0) {
      layers.push(primitives);
    }
  } else {
    warnings.push('Graphics expression must evaluate to an object or list of primitives.');
  }

  return {
    layers: layers.length > 0 ? layers : null,
    warning: warnings.length > 0 ? warnings.join(' ') : null,
    unknownTypes: Array.from(unknown)
  };
};

export const prepareGraphics = (
  extent: ViewExtent | null,
  layers: PrimitiveLayer[] | null
): PreparedGraphics => {
  if (!extent || !layers) {
    return {
      layers: [],
      warnings: extent ? [] : ['Cannot render without a valid view extent.']
    };
  }

  const warnings: string[] = [];
  const preparedLayers: PreparedPrimitive[][] = [];

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    const layer = layers[layerIndex];
    const prepared: PreparedPrimitive[] = [];

    for (let primitiveIndex = 0; primitiveIndex < layer.length; primitiveIndex += 1) {
      const primitive = layer[primitiveIndex];
      const ctx = `layer ${layerIndex + 1}, primitive ${primitiveIndex + 1}`;

      try {
        switch (primitive.type) {
          case 'line': {
            const from = ensurePoint(primitive.data.from);
            const to = ensurePoint(primitive.data.to);
            if (!from || !to) {
              warnings.push(`Line in ${ctx} requires numeric from/to points.`);
              break;
            }
            const stroke = typeof primitive.data.stroke === 'string' ? primitive.data.stroke : '#38bdf8';
            const width = ensureNumber(primitive.data.width) ?? 0.25;
            const dash = Array.isArray(primitive.data.dash)
              ? primitive.data.dash.every((segment) => typeof segment === 'number' && segment >= 0)
                ? (primitive.data.dash as number[])
                : null
              : null;
            prepared.push({
              type: 'line',
              from,
              to,
              stroke,
              width,
              dash
            });
            break;
          }
          case 'rect': {
            const position = ensurePoint(primitive.data.position);
            const size = ensurePoint(primitive.data.size);
            if (!position || !size) {
              warnings.push(`Rectangle in ${ctx} requires position and size points.`);
              break;
            }
            const stroke = typeof primitive.data.stroke === 'string' ? primitive.data.stroke : null;
            const fill = typeof primitive.data.fill === 'string' ? primitive.data.fill : null;
            const width = ensureNumber(primitive.data.width) ?? 0.25;
            prepared.push({
              type: 'rect',
              position,
              size,
              stroke,
              fill,
              width
            });
            break;
          }
          case 'circle': {
            const center = ensurePoint(primitive.data.center);
            const radius = ensureNumber(primitive.data.radius);
            if (!center || radius === null || radius <= 0) {
              warnings.push(`Circle in ${ctx} requires center and positive radius.`);
              break;
            }
            const stroke = typeof primitive.data.stroke === 'string' ? primitive.data.stroke : null;
            const fill = typeof primitive.data.fill === 'string' ? primitive.data.fill : null;
            const width = ensureNumber(primitive.data.width) ?? 0.25;
            prepared.push({
              type: 'circle',
              center,
              radius,
              stroke,
              fill,
              width
            });
            break;
          }
          case 'polygon': {
            const points = ensurePoints(primitive.data.points);
            if (!points) {
              warnings.push(`Polygon in ${ctx} requires an array of at least 3 numeric points.`);
              break;
            }
            const stroke = typeof primitive.data.stroke === 'string' ? primitive.data.stroke : null;
            const fill = typeof primitive.data.fill === 'string' ? primitive.data.fill : null;
            const width = ensureNumber(primitive.data.width) ?? 0.25;
            prepared.push({
              type: 'polygon',
              points,
              stroke,
              fill,
              width
            });
            break;
          }
          case 'text': {
            const position = ensurePoint(primitive.data.position);
            const text = typeof primitive.data.text === 'string' ? primitive.data.text : null;
            if (!position || text === null) {
              warnings.push(`Text in ${ctx} requires position and text.`);
              break;
            }
            const color = typeof primitive.data.color === 'string' ? primitive.data.color : '#e2e8f0';
            const fontSize = ensureNumber(primitive.data.fontSize) ?? 1;
            const alignValue = primitive.data.align;
            const align: CanvasTextAlign = alignValue === 'right' || alignValue === 'center' ? alignValue : 'left';
            prepared.push({
              type: 'text',
              position,
              text,
              color,
              fontSize,
              align
            });
            break;
          }
          default:
            warnings.push(`No renderer for primitive type "${primitive.type}" (${ctx}).`);
            break;
        }
      } catch (err) {
        warnings.push(`Skipping ${ctx} because it threw during preparation: ${describeError(err)}.`);
      }
    }

    preparedLayers.push(prepared);
  }

  return {
    layers: preparedLayers,
    warnings
  };
};

export const projectPointBuilder = (
  extent: ViewExtent,
  canvasWidth: number,
  canvasHeight: number,
  padding: number
) => {
  const viewWidth = extent.maxX - extent.minX;
  const viewHeight = extent.maxY - extent.minY;
  const scaleX = (canvasWidth - padding * 2) / viewWidth;
  const scaleY = (canvasHeight - padding * 2) / viewHeight;
  const scale = Math.max(0.0001, Math.min(scaleX, scaleY));

  const drawWidth = viewWidth * scale;
  const drawHeight = viewHeight * scale;
  const originX = (canvasWidth - drawWidth) / 2 - extent.minX * scale;
  const originY = (canvasHeight - drawHeight) / 2 + extent.maxY * scale;

  return {
    scale,
    project(point: [number, number]) {
      const [tx, ty] = point;
      const x = originX + tx * scale;
      const y = originY - ty * scale;
      return { x, y };
    }
  };
};

export const prepareProvider = () => new DefaultFsDataProvider();
