import {
  Engine,
  FSDataType,
  FsError,
  KeyValueCollection,
  ensureTyped,
  makeValue,
  typedNull,
  type DefaultFsDataProvider,
  type FsDataProvider,
  type TypedValue
} from '@tewelde/funcscript/browser';
import { evaluateExpression, type EvaluationResult } from './graphics';
import type { CustomTabDefinition } from './examples';

export const STORAGE_KEY = 'fs-graphics-state';

export type CustomTabState = {
  id: string;
  name: string;
  expression: string;
  folderId: string | null;
};

export type CustomFolderState = {
  id: string;
  name: string;
};

export type PersistedSnapshot = {
  leftWidth?: number;
  selectedExampleId?: string;
  graphicsExpression?: string;
  viewExpression?: string;
  customTabs?: CustomTabState[];
  customFolders?: CustomFolderState[];
  activeExpressionTab?: string;
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
  return definitions.map((definition) => ({
    id: createCustomTabId(),
    name: definition.name,
    expression: definition.expression,
    folderId: null
  }));
};

const sanitizeCustomTabs = (value: unknown): CustomTabState[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const result: CustomTabState[] = [];
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
      result.push({ id, name, expression, folderId });
    }
  }
  return result;
};

const sanitizeCustomFolders = (value: unknown): CustomFolderState[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const result: CustomFolderState[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const { id, name } = entry as Partial<CustomFolderState>;
    if (typeof id === 'string' && typeof name === 'string') {
      result.push({ id, name });
    }
  }
  return result;
};

export const loadPersistedSnapshot = (): PersistedSnapshot | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
    return snapshot;
  } catch {
    return null;
  }
};

export type WorkspaceFolderDefinition = {
  folder: CustomFolderState;
  tabs: CustomTabState[];
};

class WorkspaceFolderProvider extends KeyValueCollection {
  private readonly manager: WorkspaceEvaluationManager;
  private readonly folderId: string;

  constructor(manager: WorkspaceEvaluationManager, folderId: string, parent: FsDataProvider | null) {
    super(parent ?? null);
    this.manager = manager;
    this.folderId = folderId;
  }

  private findTab(name: string): CustomTabState | null {
    return this.manager.findFolderTabByName(this.folderId, name.toLowerCase());
  }

  public override get(name: string): TypedValue | null {
    const tab = this.findTab(name);
    if (tab) {
      const evaluation = this.manager.evaluateTab(tab, this);
      return evaluation.typed ?? typedNull();
    }
    return super.get(name);
  }

  public override isDefined(name: string): boolean {
    if (this.findTab(name)) {
      return true;
    }
    return super.isDefined(name);
  }

  public override getAll(): Array<[string, TypedValue]> {
    const entries: Array<[string, TypedValue]> = [];
    const tabs = this.manager.getFolderTabs(this.folderId);
    for (const tab of tabs) {
      const evaluation = this.manager.evaluateTab(tab, this);
      entries.push([tab.name, evaluation.typed ?? typedNull()]);
    }
    return entries;
  }
}

class WorkspaceEnvironmentProvider extends Engine.FsDataProvider {
  private readonly manager: WorkspaceEvaluationManager;
  private readonly namedValues = new Map<string, TypedValue>();

  constructor(manager: WorkspaceEvaluationManager) {
    super(manager.getBaseProvider());
    this.manager = manager;
  }

  public setNamedValue(name: string, value: TypedValue | null) {
    const lower = name.toLowerCase();
    if (value) {
      this.namedValues.set(lower, ensureTyped(value));
    } else {
      this.namedValues.delete(lower);
    }
  }

  private getFolderProvider(name: string): WorkspaceFolderProvider | null {
    const folderId = this.manager.findFolderIdByName(name.toLowerCase());
    if (!folderId) {
      return null;
    }
    return this.manager.getFolderProvider(folderId);
  }

  public override get(name: string): TypedValue | null {
    const lower = name.toLowerCase();
    if (lower === 't') {
      return this.manager.getTimeValue();
    }
    if (this.namedValues.has(lower)) {
      return this.namedValues.get(lower) ?? null;
    }
    const rootTab = this.manager.findRootTabByName(lower);
    if (rootTab) {
      const evaluation = this.manager.evaluateTab(rootTab, this);
      return evaluation.typed ?? typedNull();
    }
    const folderProvider = this.getFolderProvider(lower);
    if (folderProvider) {
      return ensureTyped(folderProvider);
    }
    return super.get(name);
  }

  public override isDefined(name: string): boolean {
    const lower = name.toLowerCase();
    if (lower === 't') {
      return true;
    }
    if (this.namedValues.has(lower)) {
      return true;
    }
    if (this.manager.findRootTabByName(lower)) {
      return true;
    }
    if (this.manager.findFolderIdByName(lower)) {
      return true;
    }
    return super.isDefined(name);
  }
}

export class WorkspaceEvaluationManager {
  private readonly baseProvider: DefaultFsDataProvider;
  private readonly timeValue: TypedValue;
  private readonly rootTabs: CustomTabState[];
  private readonly rootTabByName = new Map<string, CustomTabState>();
  private readonly folderDefinitions = new Map<string, WorkspaceFolderDefinition>();
  private readonly folderNameByLower = new Map<string, string>();
  private readonly folderTabMaps = new Map<string, Map<string, CustomTabState>>();
  private readonly evaluations = new Map<string, EvaluationResult>();
  private readonly evaluating = new Set<string>();
  private readonly folderProviders = new Map<string, WorkspaceFolderProvider>();
  private environmentProvider: WorkspaceEnvironmentProvider | null = null;

  constructor(
    baseProvider: DefaultFsDataProvider,
    tabs: CustomTabState[],
    folders: CustomFolderState[],
    time: number
  ) {
    this.baseProvider = baseProvider;
    this.timeValue = ensureTyped(time);
    for (const folder of folders) {
      const entry: WorkspaceFolderDefinition = { folder, tabs: [] };
      this.folderDefinitions.set(folder.id, entry);
      this.folderNameByLower.set(folder.name.toLowerCase(), folder.id);
      this.folderTabMaps.set(folder.id, new Map());
    }

    const rootAccumulator: CustomTabState[] = [];
    for (const tab of tabs) {
      if (tab.folderId && this.folderDefinitions.has(tab.folderId)) {
        const definition = this.folderDefinitions.get(tab.folderId)!;
        definition.tabs.push(tab);
        const nameMap = this.folderTabMaps.get(tab.folderId)!;
        nameMap.set(tab.name.toLowerCase(), tab);
      } else {
        rootAccumulator.push(tab);
        this.rootTabByName.set(tab.name.toLowerCase(), tab);
      }
    }

    this.rootTabs = rootAccumulator;
    for (const definition of this.folderDefinitions.values()) {
      definition.tabs.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }
    this.rootTabs.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  public getBaseProvider() {
    return this.baseProvider;
  }

  public getTimeValue() {
    return this.timeValue;
  }

  public getEnvironmentProvider(): WorkspaceEnvironmentProvider {
    if (!this.environmentProvider) {
      this.environmentProvider = new WorkspaceEnvironmentProvider(this);
    }
    return this.environmentProvider;
  }

  public findRootTabByName(lower: string): CustomTabState | null {
    return this.rootTabByName.get(lower) ?? null;
  }

  public findFolderIdByName(lower: string): string | null {
    return this.folderNameByLower.get(lower) ?? null;
  }

  public getFolderProvider(folderId: string): WorkspaceFolderProvider {
    const existing = this.folderProviders.get(folderId);
    if (existing) {
      return existing;
    }
    const parent = this.getEnvironmentProvider();
    const provider = new WorkspaceFolderProvider(this, folderId, parent);
    this.folderProviders.set(folderId, provider);
    return provider;
  }

  public getFolderTabs(folderId: string): CustomTabState[] {
    const definition = this.folderDefinitions.get(folderId);
    return definition ? definition.tabs : [];
  }

  public hasFolder(folderId: string): boolean {
    return this.folderDefinitions.has(folderId);
  }

  public findFolderTabByName(folderId: string, lower: string): CustomTabState | null {
    const map = this.folderTabMaps.get(folderId);
    if (!map) {
      return null;
    }
    return map.get(lower) ?? null;
  }

  public evaluateTab(tab: CustomTabState, provider: FsDataProvider): EvaluationResult {
    const cached = this.evaluations.get(tab.id);
    if (cached) {
      return cached;
    }
    if (this.evaluating.has(tab.id)) {
      const message = 'Circular reference detected while evaluating expression.';
      const typedError = makeValue(FSDataType.Error, new FsError(FsError.ERROR_DEFAULT, message));
      const result: EvaluationResult = {
        value: null,
        typed: typedError,
        error: message
      };
      this.evaluations.set(tab.id, result);
      return result;
    }

    this.evaluating.add(tab.id);
    const result = evaluateExpression(provider, tab.expression);
    this.evaluating.delete(tab.id);

    let typed: TypedValue | null = result.typed;
    if (!typed) {
      if (result.error) {
        typed = makeValue(FSDataType.Error, new FsError(FsError.ERROR_DEFAULT, result.error));
      } else {
        typed = typedNull();
      }
    }
    const normalized: EvaluationResult = {
      value: result.value,
      typed,
      error: result.error
    };
    this.evaluations.set(tab.id, normalized);
    return normalized;
  }

  public getEvaluations(): Map<string, EvaluationResult> {
    return this.evaluations;
  }
}
