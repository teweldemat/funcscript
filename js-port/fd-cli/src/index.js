'use strict';

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const { FuncDraw } = require('@tewelde/funcdraw');
const FuncScript = require('@tewelde/funcscript');
const pkg = require('../package.json');

const {
  DefaultFsDataProvider,
  Engine,
  FSDataType,
  ensureTyped,
  typeOf,
  valueOf,
  typedNull
} = FuncScript;

const DEFAULT_VIEW_EXPRESSION = `{
  return { minX:-10, minY:-10, maxX:10, maxY:10 };
}`;
const DEFAULT_BACKGROUND = '#0f172a';
const DEFAULT_GRID_COLOR = 'rgba(148, 163, 184, 0.2)';
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_PADDING = 48;
const FX_EXTENSION = '.fx';

const formatNumber = (value) => {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const rounded = Math.round(value * 1000) / 1000;
  const text = rounded.toFixed(3);
  return text.replace(/\.?(?:0{1,3})$/, '');
};

const escapeAttr = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeText = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const withinRoot = (root, target) => {
  const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return target === root || target.startsWith(normalizedRoot);
};

const sanitizeSegments = (segments) => {
  if (!Array.isArray(segments)) {
    return [];
  }
  const result = [];
  for (const segment of segments) {
    if (typeof segment !== 'string') {
      continue;
    }
    const trimmed = segment.trim();
    if (!trimmed || trimmed === '.' || trimmed === '..') {
      continue;
    }
    result.push(trimmed);
  }
  return result;
};

class FilesystemExpressionCollectionResolver {
  constructor(rootPath) {
    if (!rootPath || typeof rootPath !== 'string') {
      throw new Error('Resolver root path must be provided.');
    }
    this.root = path.resolve(rootPath);
  }

  resolveFolder(segments) {
    const normalized = sanitizeSegments(segments);
    const candidate = path.resolve(this.root, ...normalized);
    if (!withinRoot(this.root, candidate)) {
      return null;
    }
    return candidate;
  }

  listItems(segments) {
    const folder = this.resolveFolder(segments);
    if (!folder) {
      return [];
    }
    let entries;
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true });
    } catch {
      return [];
    }
    const items = [];
    let index = 0;
    for (const entry of entries) {
      if (!entry || typeof entry.name !== 'string') {
        index += 1;
        continue;
      }
      if (entry.name.startsWith('.')) {
        index += 1;
        continue;
      }
      if (entry.isDirectory()) {
        items.push({ kind: 'folder', name: entry.name, createdAt: index });
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(FX_EXTENSION)) {
        const name = entry.name.slice(0, -FX_EXTENSION.length);
        if (name) {
          items.push({ kind: 'expression', name, createdAt: index });
        }
      }
      index += 1;
    }
    return items;
  }

  resolveExpressionFile(segments) {
    if (!Array.isArray(segments) || segments.length === 0) {
      return null;
    }
    const folderSegments = segments.slice(0, -1);
    const expressionName = segments[segments.length - 1];
    const folder = this.resolveFolder(folderSegments);
    if (!folder) {
      return null;
    }
    const exactPath = path.resolve(folder, `${expressionName}${FX_EXTENSION}`);
    if (withinRoot(this.root, exactPath) && fs.existsSync(exactPath) && fs.statSync(exactPath).isFile()) {
      return exactPath;
    }
    let entries;
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true });
    } catch {
      return null;
    }
    const targetLower = expressionName.trim().toLowerCase();
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      if (!entry.name.toLowerCase().endsWith(FX_EXTENSION)) {
        continue;
      }
      const base = entry.name.slice(0, -FX_EXTENSION.length);
      if (base.trim().toLowerCase() === targetLower) {
        const filePath = path.resolve(folder, entry.name);
        if (withinRoot(this.root, filePath)) {
          return filePath;
        }
      }
    }
    return null;
  }

  getExpression(segments) {
    const file = this.resolveExpressionFile(segments);
    if (!file) {
      return null;
    }
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      return null;
    }
  }
}

const parseExpressionPath = (input) => {
  if (!input || typeof input !== 'string') {
    return [];
  }
  return input
    .split(/[\\/]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.');
};

const parseNumberOption = (value, label) => {
  if (value === undefined || value === null) {
    throw new Error(`Missing value for ${label}.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number supplied for ${label}.`);
  }
  return parsed;
};

const parseArgs = (argv) => {
  const options = {
    root: process.cwd(),
    expression: null,
    view: null,
    format: 'raw',
    output: null,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    padding: DEFAULT_PADDING,
    background: DEFAULT_BACKGROUND,
    gridColor: DEFAULT_GRID_COLOR,
    jsonPretty: true,
    time: undefined,
    timeName: undefined,
    listOnly: false,
    help: false,
    version: false
  };

  let rootExplicit = false;
  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--version':
      case '-V':
        options.version = true;
        break;
      case '--root':
      case '-r':
        options.root = argv[i + 1];
        if (options.root === undefined) {
          throw new Error('--root requires a path argument.');
        }
        i += 1;
        rootExplicit = true;
        break;
      case '--expression':
      case '--expr':
      case '-e':
        options.expression = argv[i + 1] ?? null;
        if (options.expression === null) {
          throw new Error('--expression requires a value.');
        }
        i += 1;
        break;
      case '--view':
        options.view = argv[i + 1] ?? null;
        if (options.view === null) {
          throw new Error('--view requires a value.');
        }
        i += 1;
        break;
      case '--format':
      case '-f':
        options.format = (argv[i + 1] ?? 'raw').toLowerCase();
        i += 1;
        break;
      case '--out':
      case '--output':
      case '-o':
        options.output = argv[i + 1] ?? null;
        if (options.output === null) {
          throw new Error('--out requires a value.');
        }
        i += 1;
        break;
      case '--width':
        options.width = parseNumberOption(argv[i + 1], 'width');
        i += 1;
        break;
      case '--height':
        options.height = parseNumberOption(argv[i + 1], 'height');
        i += 1;
        break;
      case '--padding':
        options.padding = parseNumberOption(argv[i + 1], 'padding');
        i += 1;
        break;
      case '--background':
        options.background = argv[i + 1] ?? options.background;
        i += 1;
        break;
      case '--grid-color':
        options.gridColor = argv[i + 1] ?? options.gridColor;
        i += 1;
        break;
      case '--time':
        options.time = parseNumberOption(argv[i + 1], 'time');
        i += 1;
        break;
      case '--time-name':
        options.timeName = argv[i + 1] ?? undefined;
        i += 1;
        break;
      case '--list':
        options.listOnly = true;
        break;
      case '--compact':
        options.jsonPretty = false;
        break;
      default:
        if (arg && arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`);
        }
        positionals.push(arg);
        break;
    }
  }

  if (!rootExplicit && positionals.length > 0) {
    options.root = positionals.shift();
  }
  if (!options.expression && positionals.length > 0) {
    options.expression = positionals.shift();
  }
  if (!options.view && positionals.length > 0) {
    options.view = positionals.shift();
  }

  if (!['raw', 'svg', 'png'].includes(options.format)) {
    throw new Error(`Unsupported format: ${options.format}`);
  }

  options.width = Math.max(64, Math.floor(options.width));
  options.height = Math.max(64, Math.floor(options.height));
  options.padding = Math.max(0, Math.floor(options.padding));

  return options;
};

const printHelp = () => {
  const lines = [
    'FuncDraw CLI',
    '',
    'Usage:',
    '  fd-cli --root <folder> --expression <path> [options]',
    '',
    'Options:',
    '  -r, --root <path>        Root folder that contains .fx files.',
    '  -e, --expression <path>  Expression path (e.g. graphics/shapes/main).',
    '      --view <path>        Optional view expression path (defaults to built-in view).',
    '  -f, --format <type>      Output format: raw | svg | png (default raw).',
    '  -o, --out <file>         Target file for svg/png output (stdout if omitted for svg).',
    '      --width <px>         Output width for svg/png (default 1280).',
    '      --height <px>        Output height for svg/png (default 720).',
    '      --padding <px>       Padding around content (default 48).',
    '      --background <color> Background color for svg/png.',
    '      --grid-color <color> Axis color for svg/png.',
    '      --time <seconds>     Timestamp (in seconds) to inject as the time variable.',
    '      --time-name <name>   Name of the time variable (defaults to "t").',
    '      --list               List expressions discovered under the root.',
    '      --compact            Compact JSON for raw output.',
    '  -h, --help               Show this help.',
    '  -V, --version            Print version.',
    '',
    'Examples:',
    '  fd-cli --root ./workspace --expression graphics/main',
    '  fd-cli ./workspace graphics/main --view settings/view --format svg --out render.svg'
  ];
  console.log(lines.join('\n'));
};

const toPlainValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  let typed;
  try {
    typed = ensureTyped(value);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  const dataType = typeOf(typed);
  const raw = valueOf(typed);
  switch (dataType) {
    case FSDataType.Null:
    case FSDataType.Boolean:
    case FSDataType.Integer:
    case FSDataType.Float:
    case FSDataType.String:
    case FSDataType.BigInteger:
    case FSDataType.Guid:
    case FSDataType.DateTime:
      return raw;
    case FSDataType.ByteArray: {
      if (raw instanceof Uint8Array) {
        return Buffer.from(raw).toString('base64');
      }
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(raw)) {
        return raw.toString('base64');
      }
      return raw;
    }
    case FSDataType.List: {
      if (!raw || typeof raw[Symbol.iterator] !== 'function') {
        return [];
      }
      const entries = [];
      for (const entry of raw) {
        entries.push(toPlainValue(entry));
      }
      return entries;
    }
    case FSDataType.KeyValueCollection: {
      if (!raw || typeof raw.getAll !== 'function') {
        return {};
      }
      const result = {};
      for (const [key, entry] of raw.getAll()) {
        result[key] = toPlainValue(entry);
      }
      return result;
    }
    case FSDataType.Error: {
      const err = raw || {};
      const data = err.errorData;
      let converted = data;
      if (Array.isArray(data) && data.length === 2 && typeof data[0] === 'number') {
        try {
          converted = toPlainValue(data);
        } catch {
          converted = null;
        }
      }
      return {
        errorType: err.errorType || 'Error',
        errorMessage: err.errorMessage || '',
        errorData: converted ?? null
      };
    }
    default:
      return raw;
  }
};

const evaluateDirectExpression = (provider, expression) => {
  const trimmed = typeof expression === 'string' ? expression.trim() : '';
  if (!trimmed) {
    return { value: null, typed: typedNull(), error: null };
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

const ensureNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const ensurePoint = (value) => {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }
  const [x, y] = value;
  if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
    return [x, y];
  }
  return null;
};

const ensurePoints = (value) => {
  if (!Array.isArray(value) || value.length < 3) {
    return null;
  }
  const points = [];
  for (const entry of value) {
    const point = ensurePoint(entry);
    if (!point) {
      return null;
    }
    points.push(point);
  }
  return points;
};

const describeError = (err) => (err instanceof Error ? err.message : String(err));

const collectPrimitives = (node, pathLabel, warnings, unknownTypes) => {
  const location = pathLabel || 'root';
  if (Array.isArray(node)) {
    const primitives = [];
    node.forEach((child, index) => {
      primitives.push(...collectPrimitives(child, `${location}[${index}]`, warnings, unknownTypes));
    });
    return primitives;
  }
  if (node && typeof node === 'object') {
    let type;
    let data;
    let transform;
    try {
      ({ type, data, transform } = node);
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
          `Primitive at ${location} includes a transform, but transforms are not supported and will be ignored.`
        );
      }
      return [{ type, data }];
    }
    warnings.push(`Primitive at ${location} must include string 'type' and object 'data'.`);
    return [];
  }
  warnings.push(`Skipping graphics entry at ${location} because it is not a list or object.`);
  return [];
};

const interpretGraphics = (value) => {
  if (value === null || value === undefined) {
    return {
      layers: null,
      warning: 'Graphics expression returned null.',
      unknownTypes: []
    };
  }
  const warnings = [];
  const unknown = new Set();
  const layers = [];
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

const interpretView = (value) => {
  if (value === null || value === undefined) {
    return { extent: null, warning: 'View expression returned null.' };
  }
  if (Array.isArray(value) || typeof value !== 'object') {
    return { extent: null, warning: 'View expression must return { minX, minY, maxX, maxY }.' };
  }
  const record = value;
  const minX = ensureNumber(record.minX);
  const maxX = ensureNumber(record.maxX);
  const minY = ensureNumber(record.minY);
  const maxY = ensureNumber(record.maxY);
  if (minX === null || maxX === null || minY === null || maxY === null) {
    return { extent: null, warning: 'All extent fields must be finite numbers.' };
  }
  if (maxX <= minX || maxY <= minY) {
    return { extent: null, warning: 'Extent must define a positive width and height.' };
  }
  return {
    extent: { minX, maxX, minY, maxY },
    warning: null
  };
};

const prepareGraphics = (extent, layers) => {
  if (!extent || !layers) {
    return { layers: [], warnings: extent ? [] : ['Cannot render without a valid view extent.'] };
  }
  const warnings = [];
  const preparedLayers = [];
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    const layer = layers[layerIndex];
    const prepared = [];
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
                ? primitive.data.dash
                : null
              : null;
            prepared.push({ type: 'line', from, to, stroke, width, dash });
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
            prepared.push({ type: 'rect', position, size, stroke, fill, width });
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
            prepared.push({ type: 'circle', center, radius, stroke, fill, width });
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
            prepared.push({ type: 'polygon', points, stroke, fill, width });
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
            const align = alignValue === 'right' || alignValue === 'center' ? alignValue : 'left';
            prepared.push({ type: 'text', position, text, color, fontSize, align });
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
  return { layers: preparedLayers, warnings };
};

const projectPointBuilder = (extent, canvasWidth, canvasHeight, padding) => {
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
    project(point) {
      const [tx, ty] = point;
      const x = originX + tx * scale;
      const y = originY - ty * scale;
      return { x, y };
    }
  };
};

const renderSvgDocument = (extent, graphics, options) => {
  if (!extent) {
    throw new Error('Cannot render SVG without a view extent.');
  }
  if (!graphics.layers || graphics.layers.length === 0) {
    throw new Error('No graphics primitives to render.');
  }
  const width = options.width;
  const height = options.height;
  const padding = options.padding;
  const background = options.background || DEFAULT_BACKGROUND;
  const gridColor = options.gridColor || DEFAULT_GRID_COLOR;
  const projector = projectPointBuilder(extent, width, height, padding);
  const { project, scale } = projector;
  const lines = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">`
  );
  lines.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${escapeAttr(background)}" />`);

  const drawAxis = () => {
    const axisLines = [];
    if (extent.minY <= 0 && extent.maxY >= 0) {
      const left = project([extent.minX, 0]);
      const right = project([extent.maxX, 0]);
      axisLines.push(
        `<line x1="${formatNumber(left.x)}" y1="${formatNumber(left.y)}" x2="${formatNumber(right.x)}" y2="${formatNumber(right.y)}" stroke="${escapeAttr(
          gridColor
        )}" stroke-width="1" stroke-dasharray="4 6" />`
      );
    }
    if (extent.minX <= 0 && extent.maxX >= 0) {
      const bottom = project([0, extent.minY]);
      const top = project([0, extent.maxY]);
      axisLines.push(
        `<line x1="${formatNumber(bottom.x)}" y1="${formatNumber(bottom.y)}" x2="${formatNumber(top.x)}" y2="${formatNumber(top.y)}" stroke="${escapeAttr(
          gridColor
        )}" stroke-width="1" stroke-dasharray="4 6" />`
      );
    }
    return axisLines;
  };

  lines.push(...drawAxis());

  const lineElement = (primitive) => {
    const start = project(primitive.from);
    const end = project(primitive.to);
    const dash = Array.isArray(primitive.dash) && primitive.dash.length > 0
      ? ` stroke-dasharray="${primitive.dash
          .map((segment) => Math.max(0, segment) * scale)
          .map(formatNumber)
          .join(' ')}"`
      : '';
    return `<line x1="${formatNumber(start.x)}" y1="${formatNumber(start.y)}" x2="${formatNumber(end.x)}" y2="${formatNumber(end.y)}" stroke="${escapeAttr(
      primitive.stroke
    )}" stroke-width="${formatNumber(Math.max(1, primitive.width * scale))}" stroke-linecap="round" stroke-linejoin="round"${dash} />`;
  };

  const rectElement = (primitive) => {
    const [x, y] = primitive.position;
    const [w, h] = primitive.size;
    const corners = [
      project([x, y]),
      project([x + w, y]),
      project([x + w, y + h]),
      project([x, y + h])
    ];
    const points = corners.map((point) => `${formatNumber(point.x)},${formatNumber(point.y)}`).join(' ');
    const fill = primitive.fill ? ` fill="${escapeAttr(primitive.fill)}"` : '';
    const stroke =
      primitive.stroke && primitive.width > 0
        ? ` stroke="${escapeAttr(primitive.stroke)}" stroke-width="${formatNumber(Math.max(1, primitive.width * scale))}"`
        : '';
    return `<polygon points="${points}"${fill}${stroke} />`;
  };

  const circleElement = (primitive) => {
    const center = project(primitive.center);
    const radius = Math.max(0, primitive.radius * scale);
    const fill = primitive.fill ? ` fill="${escapeAttr(primitive.fill)}"` : ' fill="none"';
    const stroke =
      primitive.stroke && primitive.width > 0
        ? ` stroke="${escapeAttr(primitive.stroke)}" stroke-width="${formatNumber(Math.max(1, primitive.width * scale))}"`
        : '';
    return `<circle cx="${formatNumber(center.x)}" cy="${formatNumber(center.y)}" r="${formatNumber(radius)}"${fill}${stroke} />`;
  };

  const polygonElement = (primitive) => {
    if (primitive.points.length < 3) {
      return '';
    }
    const points = primitive.points
      .map((point) => {
        const projected = project(point);
        return `${formatNumber(projected.x)},${formatNumber(projected.y)}`;
      })
      .join(' ');
    const fill = primitive.fill ? ` fill="${escapeAttr(primitive.fill)}"` : ' fill="none"';
    const stroke =
      primitive.stroke && primitive.width > 0
        ? ` stroke="${escapeAttr(primitive.stroke)}" stroke-width="${formatNumber(Math.max(1, primitive.width * scale))}"`
        : '';
    return `<polygon points="${points}"${fill}${stroke} />`;
  };

  const textElement = (primitive) => {
    const position = project(primitive.position);
    const fontSize = Math.max(12, primitive.fontSize * scale);
    const align = primitive.align === 'center' ? 'middle' : primitive.align === 'right' ? 'end' : 'start';
    return `<text x="${formatNumber(position.x)}" y="${formatNumber(position.y)}" fill="${escapeAttr(
      primitive.color
    )}" font-size="${formatNumber(fontSize)}" text-anchor="${align}" dominant-baseline="middle">${escapeText(
      primitive.text
    )}</text>`;
  };

  graphics.layers.forEach((layer) => {
    if (!layer || layer.length === 0) {
      return;
    }
    lines.push('<g>');
    for (const primitive of layer) {
      switch (primitive.type) {
        case 'line':
          lines.push(lineElement(primitive));
          break;
        case 'rect':
          lines.push(rectElement(primitive));
          break;
        case 'circle':
          lines.push(circleElement(primitive));
          break;
        case 'polygon':
          lines.push(polygonElement(primitive));
          break;
        case 'text':
          lines.push(textElement(primitive));
          break;
        default:
          break;
      }
    }
    lines.push('</g>');
  });

  lines.push('</svg>');
  return lines.join('');
};

const svgToPngBuffer = (svg) => {
  const renderer = new Resvg(svg, {
    fitTo: {
      mode: 'original'
    }
  });
  const image = renderer.render();
  return image.asPng();
};

const ensurePathSegments = (value, label) => {
  const segments = parseExpressionPath(value);
  if (segments.length === 0) {
    throw new Error(`Provide a valid ${label}.`);
  }
  return segments;
};

const pathToString = (segments) => segments.join('/');

const printExpressionList = (funcDraw) => {
  const folders = funcDraw.listFolders([]);
  const expressions = funcDraw.listExpressions();
  if (folders.length === 0 && expressions.length === 0) {
    console.log('No expressions found.');
    return;
  }
  if (folders.length > 0) {
    console.log('Folders:');
    folders.forEach((folder) => {
      console.log(`  - ${pathToString(folder.path) || '(root)'}`);
    });
  }
  if (expressions.length > 0) {
    console.log('Expressions:');
    expressions
      .slice()
      .sort((a, b) => pathToString(a.path).localeCompare(pathToString(b.path)))
      .forEach((expression) => {
        console.log(`  - ${pathToString(expression.path)}`);
      });
  }
};

const createFuncDraw = (resolver, options) => {
  const baseProvider = new DefaultFsDataProvider();
  const evaluateOptions = { baseProvider };
  if (options.timeName) {
    evaluateOptions.timeName = options.timeName;
  }
  const timeValue = typeof options.time === 'number' && Number.isFinite(options.time) ? options.time : undefined;
  return FuncDraw.evaluate(resolver, timeValue, evaluateOptions);
};

const outputRawResult = (result, options) => {
  const payload = {
    value: result.value,
    error: result.error,
    type: result.typed ? typeOf(result.typed) : null
  };
  const json = JSON.stringify(payload, null, options.jsonPretty ? 2 : 0);
  console.log(json);
};

const main = () => {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }
  if (options.version) {
    console.log(`fd-cli v${pkg.version}`);
    return;
  }

  const resolver = new FilesystemExpressionCollectionResolver(options.root);
  const funcDraw = createFuncDraw(resolver, options);

  if (options.listOnly) {
    printExpressionList(funcDraw);
    return;
  }

  if (!options.expression) {
    console.error('Missing --expression.');
    process.exitCode = 1;
    return;
  }

  const expressionSegments = ensurePathSegments(options.expression, 'expression path');
  const evaluation = funcDraw.evaluateExpression(expressionSegments);
  if (!evaluation) {
    console.error(`Expression "${pathToString(expressionSegments)}" was not found.`);
    process.exitCode = 1;
    return;
  }
  if (evaluation.error) {
    console.error(`Failed to evaluate ${pathToString(expressionSegments)}: ${evaluation.error}`);
    process.exitCode = 1;
    return;
  }

  if (options.format === 'raw') {
    outputRawResult(evaluation, options);
    return;
  }

  const graphicsValue = evaluation.value;
  const graphicsInfo = interpretGraphics(graphicsValue);
  const warnings = [];
  if (graphicsInfo.warning) {
    warnings.push(graphicsInfo.warning);
  }
  if (graphicsInfo.unknownTypes.length > 0) {
    warnings.push(`Unknown primitive types: ${graphicsInfo.unknownTypes.join(', ')}.`);
  }

  const environmentProvider = funcDraw.environmentProvider;
  let viewResult = null;
  if (options.view) {
    const viewSegments = ensurePathSegments(options.view, 'view path');
    viewResult = funcDraw.evaluateExpression(viewSegments);
    if (!viewResult) {
      warnings.push(`View expression "${pathToString(viewSegments)}" was not found; falling back to default view.`);
    } else if (viewResult.error) {
      warnings.push(`View expression error: ${viewResult.error}; falling back to default view.`);
      viewResult = null;
    }
  }
  if (!viewResult) {
    viewResult = evaluateDirectExpression(environmentProvider, DEFAULT_VIEW_EXPRESSION);
  }

  const viewInfo = interpretView(viewResult.value);
  if (viewInfo.warning) {
    warnings.push(viewInfo.warning);
  }

  const prepared = prepareGraphics(viewInfo.extent, graphicsInfo.layers);
  if (prepared.warnings.length > 0) {
    warnings.push(...prepared.warnings);
  }

  if (!viewInfo.extent || prepared.layers.length === 0) {
    console.error('Unable to render: missing view extent or graphics primitives.');
    if (warnings.length > 0) {
      warnings.forEach((warning) => console.error(`- ${warning}`));
    }
    process.exitCode = 1;
    return;
  }

  const svgOptions = {
    width: options.width,
    height: options.height,
    padding: options.padding,
    background: options.background,
    gridColor: options.gridColor
  };

  let svg;
  try {
    svg = renderSvgDocument(viewInfo.extent, prepared, svgOptions);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  if (options.format === 'svg') {
    if (options.output) {
      fs.writeFileSync(path.resolve(options.output), svg, 'utf8');
      console.log(`SVG written to ${options.output}`);
    } else {
      console.log(svg);
    }
  } else if (options.format === 'png') {
    const target = options.output ? path.resolve(options.output) : path.resolve(process.cwd(), 'fd-output.png');
    const pngBuffer = svgToPngBuffer(svg);
    fs.writeFileSync(target, pngBuffer);
    console.log(`PNG written to ${target}`);
  }

  if (warnings.length > 0) {
    warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
  }
};

main();
