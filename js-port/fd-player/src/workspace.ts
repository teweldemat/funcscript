import type { ExpressionCollectionResolver, ExpressionListItem } from '@tewelde/funcdraw';
import type { CustomTabDefinition } from './examples';

export const STORAGE_KEY = 'fd-player-state';

export type CustomTabState = {
  id: string;
  name: string;
  expression: string;
  folderId: string | null;
  createdAt: number;
};

export type CustomFolderState = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
};

export type PersistedSnapshot = {
  leftWidth?: number;
  selectedExampleId?: string;
  graphicsExpression?: string;
  viewExpression?: string;
  customTabs?: CustomTabState[];
  customFolders?: CustomFolderState[];
  activeExpressionTab?: string;
  treeWidth?: number;
  expandedFolderIds?: string[];
  expandedFoldersByExample?: Record<string, string[]>;
  collapsedFoldersByExample?: Record<string, string[]>;
};

export const createCustomTabId = () =>
  `custom-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

export const createCustomFolderId = () =>
  `folder-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

export const isValidTabName = (name: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);

export const buildDefaultTabName = (existingNames: Set<string>) => {
  let index = 1;
  let candidate = `model${index}`;
  while (existingNames.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `model${index}`;
  }
  return candidate;
};

export const buildDefaultFolderName = (existingNames: Set<string>) => {
  let index = 1;
  let candidate = `Folder ${index}`;
  while (existingNames.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `Folder ${index}`;
  }
  return candidate;
};

export const createCustomTabsFromDefinitions = (
  definitions?: CustomTabDefinition[]
): CustomTabState[] => {
  if (!definitions || definitions.length === 0) {
    return [];
  }
  return definitions.map((definition, index) => ({
    id: createCustomTabId(),
    name: definition.name,
    expression: definition.expression,
    folderId: null,
    createdAt: index
  }));
};

const sanitizeCustomTabs = (value: unknown): CustomTabState[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const result: CustomTabState[] = [];
  let fallbackCounter = 0;
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const { id, name, expression } = entry as Partial<CustomTabState>;
    if (typeof id === 'string' && typeof name === 'string' && typeof expression === 'string') {
      let folderId: string | null = null;
      if ('folderId' in entry) {
        const candidate = (entry as { folderId?: unknown }).folderId;
        if (typeof candidate === 'string') {
          folderId = candidate;
        } else if (candidate === null) {
          folderId = null;
        }
      }
      let createdAt = Date.now() + fallbackCounter;
      if ('createdAt' in entry) {
        const candidate = (entry as { createdAt?: unknown }).createdAt;
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
          createdAt = candidate;
        }
      } else {
        createdAt = fallbackCounter;
      }
      fallbackCounter += 1;
      result.push({ id, name, expression, folderId, createdAt });
    }
  }
  return result;
};

const sanitizeCustomFolders = (value: unknown): CustomFolderState[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const result: CustomFolderState[] = [];
  let fallbackCounter = 0;
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const { id, name } = entry as Partial<CustomFolderState>;
    if (typeof id === 'string' && typeof name === 'string') {
      let parentId: string | null = null;
      if ('parentId' in entry) {
        const candidate = (entry as { parentId?: unknown }).parentId;
        if (typeof candidate === 'string') {
          parentId = candidate;
        } else if (candidate === null) {
          parentId = null;
        }
      }
      let createdAt = Date.now() + fallbackCounter;
      if ('createdAt' in entry) {
        const candidate = (entry as { createdAt?: unknown }).createdAt;
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
          createdAt = candidate;
        }
      } else {
        createdAt = fallbackCounter;
      }
      fallbackCounter += 1;
      result.push({ id, name, parentId, createdAt });
    }
  }
  return result;
};

const sanitizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      result.push(entry);
    }
  }
  return result.length > 0 ? result : [];
};

const sanitizeFolderPathMap = (value: unknown): Record<string, string[]> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const entries: Record<string, string[]> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key !== 'string') {
      continue;
    }
    const sanitized = sanitizeStringArray(raw);
    if (sanitized !== undefined) {
      entries[key] = sanitized;
    }
  }
  return Object.keys(entries).length > 0 ? entries : {};
};

export const loadPersistedSnapshot = (storageKey: string = STORAGE_KEY): PersistedSnapshot | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw) as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') {
      return null;
    }
    const snapshot: PersistedSnapshot = {};
    if (typeof data.leftWidth === 'number' && Number.isFinite(data.leftWidth)) {
      snapshot.leftWidth = data.leftWidth;
    }
    if (typeof data.selectedExampleId === 'string') {
      snapshot.selectedExampleId = data.selectedExampleId;
    }
    if (typeof data.graphicsExpression === 'string') {
      snapshot.graphicsExpression = data.graphicsExpression;
    }
    if (typeof data.viewExpression === 'string') {
      snapshot.viewExpression = data.viewExpression;
    }
    if (typeof data.activeExpressionTab === 'string') {
      snapshot.activeExpressionTab = data.activeExpressionTab;
    }
    if ('customTabs' in data) {
      const sanitized = sanitizeCustomTabs(data.customTabs);
      if (sanitized) {
        snapshot.customTabs = sanitized;
      }
    }
    if ('customFolders' in data) {
      const sanitizedFolders = sanitizeCustomFolders(data.customFolders);
      if (sanitizedFolders) {
        snapshot.customFolders = sanitizedFolders;
      }
    }
    if (typeof data.treeWidth === 'number' && Number.isFinite(data.treeWidth)) {
      snapshot.treeWidth = data.treeWidth;
    }
    if ('expandedFolderIds' in data) {
      const expanded = sanitizeStringArray(data.expandedFolderIds);
      if (expanded !== undefined) {
        snapshot.expandedFolderIds = expanded;
      }
    }
    if ('expandedFoldersByExample' in data) {
      const expandedByExample = sanitizeFolderPathMap(data.expandedFoldersByExample);
      if (expandedByExample !== undefined) {
        snapshot.expandedFoldersByExample = expandedByExample;
      }
    }
    if ('collapsedFoldersByExample' in data) {
      const collapsedByExample = sanitizeFolderPathMap(data.collapsedFoldersByExample);
      if (collapsedByExample !== undefined) {
        snapshot.collapsedFoldersByExample = collapsedByExample;
      }
    }
    return snapshot;
  } catch {
    return null;
  }
};

type ResolverInit = {
  tabs?: CustomTabState[];
  folders?: CustomFolderState[];
};

const normalizePathSegments = (segments: string[]): string[] =>
  segments
    .filter((segment) => typeof segment === 'string' && segment.trim().length > 0)
    .map((segment) => segment.trim());

const sortByCreatedAt = <T extends { createdAt?: number }>(list: T[]): T[] =>
  [...list].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

export class LocalStorageExpressionCollectionResolver implements ExpressionCollectionResolver {
  private readonly storageKey: string;
  private readonly tabs: CustomTabState[];
  private readonly folders: CustomFolderState[];
  private readonly folderById = new Map<string, CustomFolderState>();
  private readonly folderChildren = new Map<string | null, CustomFolderState[]>();
  private readonly folderNameMaps = new Map<string | null, Map<string, CustomFolderState>>();
  private readonly folderPathCache = new Map<string, string[]>();
  private readonly tabMaps = new Map<string | null, Map<string, CustomTabState>>();
  private readonly tabPaths = new Map<string, string[]>();

  constructor(storageKey: string, data?: ResolverInit) {
    this.storageKey = storageKey;
    const snapshot = this.prepareState(data);
    this.tabs = snapshot.tabs;
    this.folders = snapshot.folders;
    this.hydrateFolders();
    this.hydrateTabs();
  }

  private prepareState(data?: ResolverInit) {
    if (data && Array.isArray(data.tabs) && Array.isArray(data.folders)) {
      return {
        tabs: [...data.tabs],
        folders: [...data.folders]
      };
    }
    const snapshot = loadPersistedSnapshot(this.storageKey);
    return {
      tabs: snapshot?.customTabs ? [...snapshot.customTabs] : [],
      folders: snapshot?.customFolders ? [...snapshot.customFolders] : []
    };
  }

  private hydrateFolders() {
    for (const folder of this.folders) {
      this.folderById.set(folder.id, folder);
      const parentId = folder.parentId ?? null;
      if (!this.folderChildren.has(parentId)) {
        this.folderChildren.set(parentId, []);
      }
      this.folderChildren.get(parentId)!.push(folder);
      if (!this.folderNameMaps.has(parentId)) {
        this.folderNameMaps.set(parentId, new Map());
      }
      const nameMap = this.folderNameMaps.get(parentId)!;
      const lower = folder.name.toLowerCase();
      if (!nameMap.has(lower)) {
        nameMap.set(lower, folder);
      }
    }
    for (const children of this.folderChildren.values()) {
      sortByCreatedAt(children);
    }
  }

  private buildFolderPath(folderId: string | null, seen = new Set<string>()): string[] {
    if (!folderId) {
      return [];
    }
    if (this.folderPathCache.has(folderId)) {
      return this.folderPathCache.get(folderId)!;
    }
    const folder = this.folderById.get(folderId);
    if (!folder || seen.has(folderId)) {
      return [];
    }
    seen.add(folderId);
    const parentPath = this.buildFolderPath(folder.parentId ?? null, seen);
    const path = [...parentPath, folder.name];
    this.folderPathCache.set(folderId, path);
    seen.delete(folderId);
    return path;
  }

  private hydrateTabs() {
    for (const tab of this.tabs) {
      const folderId = tab.folderId && this.folderById.has(tab.folderId) ? tab.folderId : null;
      const key = folderId ?? null;
      if (!this.tabMaps.has(key)) {
        this.tabMaps.set(key, new Map());
      }
      const map = this.tabMaps.get(key)!;
      const lower = tab.name.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, tab);
      }
      const folderPath = folderId ? this.buildFolderPath(folderId) : [];
      this.tabPaths.set(tab.id, [...folderPath, tab.name]);
    }
  }

  private resolveFolderId(path: string[]): string | null | undefined {
    const cleaned = normalizePathSegments(path);
    if (cleaned.length === 0) {
      return null;
    }
    let current: string | null = null;
    for (const segment of cleaned) {
      const nameMap = this.folderNameMaps.get(current);
      if (!nameMap) {
        return undefined;
      }
      const folder = nameMap.get(segment.toLowerCase());
      if (!folder) {
        return undefined;
      }
      current = folder.id;
    }
    return current;
  }

  public listItems(path: string[]): ExpressionListItem[] {
    const folderId = this.resolveFolderId(path);
    if (folderId === undefined && normalizePathSegments(path).length > 0) {
      return [];
    }
    const parentKey = folderId ?? null;
    const folders = this.folderChildren.get(parentKey) ?? [];
    const tabMap = this.tabMaps.get(parentKey) ?? new Map();
    const items: ExpressionListItem[] = [];
    for (const folder of folders) {
      items.push({ kind: 'folder', name: folder.name, createdAt: folder.createdAt });
    }
    for (const tab of tabMap.values()) {
      items.push({ kind: 'expression', name: tab.name, createdAt: tab.createdAt });
    }
    return sortByCreatedAt(items);
  }

  public getExpression(path: string[]): string | null {
    const cleaned = normalizePathSegments(path);
    if (cleaned.length === 0) {
      return null;
    }
    const targetName = cleaned[cleaned.length - 1];
    const folderPath = cleaned.slice(0, -1);
    const folderId = this.resolveFolderId(folderPath);
    if (folderId === undefined && folderPath.length > 0) {
      return null;
    }
    const map = this.tabMaps.get(folderId ?? null);
    if (!map) {
      return null;
    }
    const tab = map.get(targetName.toLowerCase());
    return tab ? tab.expression : null;
  }

  public getPathForTab(tabId: string): string[] | null {
    const path = this.tabPaths.get(tabId);
    return path ? [...path] : null;
  }
}
