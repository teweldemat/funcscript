declare const require: any;

type ExampleModule = string | { default: string };

export type ExampleDefinition = {
  id: string;
  name: string;
  view: string;
  graphics: string;
};

const viewContext = require.context('./', true, /view\.fx$/);
const graphicsContext = require.context('./', true, /graphics\.fx$/);

const collectKeys = (context: any): Set<string> => {
  const keys: string[] = context.keys();
  const ids = new Set<string>();
  for (const key of keys) {
    const normalized = key.replace(/^\.\//, '');
    const [folder] = normalized.split('/');
    if (folder) {
      ids.add(folder);
    }
  }
  return ids;
};

const viewIds = collectKeys(viewContext);
const graphicIds = collectKeys(graphicsContext);
const allIds = new Set<string>([...Array.from(viewIds), ...Array.from(graphicIds)]);

const readModule = (context: any, path: string): string | null => {
  if (!context) {
    return null;
  }
  try {
    const mod: ExampleModule = context(path);
    if (typeof mod === 'string') {
      return mod;
    }
    if (mod && typeof mod.default === 'string') {
      return mod.default;
    }
    return String(mod ?? '');
  } catch (err) {
    return null;
  }
};

const formatName = (id: string): string =>
  id
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const examples: ExampleDefinition[] = [];

for (const id of allIds) {
  const viewPath = `./${id}/view.fx`;
  const graphicsPath = `./${id}/graphics.fx`;
  const view = readModule(viewContext, viewPath);
  const graphics = readModule(graphicsContext, graphicsPath);
  if (!view || !graphics) {
    continue;
  }
  examples.push({
    id,
    name: formatName(id),
    view,
    graphics
  });
}

examples.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

export default examples;
