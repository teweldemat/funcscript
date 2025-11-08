declare const require: any;

type ExampleModule = string | { default: string };

export type CustomTabDefinition = {
  name: string;
  expression: string;
};

export type CustomFolderDefinition = {
  name: string;
  tabs: CustomTabDefinition[];
  folders: CustomFolderDefinition[];
};

export type ExampleDefinition = {
  id: string;
  name: string;
  view: string;
  graphics: string;
  customTabs: CustomTabDefinition[];
  customFolders: CustomFolderDefinition[];
};

const fxContext = require.context('./', true, /\.fx$/);

const collectExampleIds = (context: any): Set<string> => {
  const ids = new Set<string>();
  const keys: string[] = context.keys();
  for (const key of keys) {
    const normalized = key.replace(/^\.\//, '');
    const [folder] = normalized.split('/');
    if (folder) {
      ids.add(folder);
    }
  }
  return ids;
};

const allIds = collectExampleIds(fxContext);

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

const isValidTabName = (name: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);

type FolderBuilder = {
  name: string;
  tabs: CustomTabDefinition[];
  tabNames: Set<string>;
  children: Map<string, FolderBuilder>;
};

const createFolderBuilder = (name: string): FolderBuilder => ({
  name,
  tabs: [],
  tabNames: new Set<string>(),
  children: new Map<string, FolderBuilder>()
});

const collectCustomStructure = (id: string): {
  tabs: CustomTabDefinition[];
  folders: CustomFolderDefinition[];
} => {
  const prefix = `./${id}/`;
  const tabs: CustomTabDefinition[] = [];
  const seenRootTabs = new Set<string>();
  const rootFolders = new Map<string, FolderBuilder>();

  const ensureFolderPath = (segments: string[]): FolderBuilder | null => {
    if (segments.length === 0) {
      return null;
    }
    let currentMap = rootFolders;
    let currentFolder: FolderBuilder | null = null;
    for (const segment of segments) {
      if (!isValidTabName(segment)) {
        return null;
      }
      const lower = segment.toLowerCase();
      let folder = currentMap.get(lower);
      if (!folder) {
        folder = createFolderBuilder(segment);
        currentMap.set(lower, folder);
      }
      currentFolder = folder;
      currentMap = folder.children;
    }
    return currentFolder;
  };

  const addFolderTab = (folder: FolderBuilder, name: string, expression: string) => {
    const lower = name.toLowerCase();
    if (folder.tabNames.has(lower)) {
      return;
    }
    folder.tabNames.add(lower);
    folder.tabs.push({ name, expression });
  };

  for (const key of fxContext.keys()) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    const remainder = key.slice(prefix.length);
    if (!remainder.endsWith('.fx')) {
      continue;
    }
    if (remainder === 'view.fx' || remainder === 'main.fx') {
      continue;
    }

    const expression = readModule(fxContext, key);
    if (!expression) {
      continue;
    }

    const parts = remainder.split('/');
    const fileName = parts.pop();
    if (!fileName) {
      continue;
    }
    const tabName = fileName.replace(/\.fx$/, '');
    if (!isValidTabName(tabName)) {
      continue;
    }

    if (parts.length === 0) {
      const lower = tabName.toLowerCase();
      if (seenRootTabs.has(lower)) {
        continue;
      }
      seenRootTabs.add(lower);
      tabs.push({ name: tabName, expression });
      continue;
    }

    const folder = ensureFolderPath(parts);
    if (!folder) {
      continue;
    }
    addFolderTab(folder, tabName, expression);
  }

  const sortTabs = (list: CustomTabDefinition[]) =>
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  sortTabs(tabs);

  const convertFolders = (builders: Map<string, FolderBuilder>): CustomFolderDefinition[] =>
    Array.from(builders.values())
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .map((builder) => ({
        name: builder.name,
        tabs: sortTabs([...builder.tabs]),
        folders: convertFolders(builder.children)
      }));

  const customFolders = convertFolders(rootFolders);
  return { tabs, folders: customFolders };
};

const examples: ExampleDefinition[] = [];

for (const id of allIds) {
  const viewPath = `./${id}/view.fx`;
  const graphicsPath = `./${id}/main.fx`;
  const view = readModule(fxContext, viewPath);
  const graphics = readModule(fxContext, graphicsPath);
  if (!view || !graphics) {
    continue;
  }
  const { tabs: customTabs, folders: customFolders } = collectCustomStructure(id);
  examples.push({
    id,
    name: formatName(id),
    view,
    graphics,
    customTabs,
    customFolders
  });
}

examples.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

export default examples;
