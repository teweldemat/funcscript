import {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  defaultGraphicsExpression,
  defaultViewExpression,
  evaluateExpression,
  interpretGraphics,
  interpretView,
  prepareGraphics,
  prepareProvider,
  projectPointBuilder,
  type EvaluationResult
} from './graphics';
import type { PreparedGraphics, PreparedPrimitive, ViewExtent } from './graphics';
import './App.css';
import { FuncScriptEditor } from '@tewelde/funcscript-editor';
import { FuncDraw } from '@tewelde/funcdraw';
import examples, { type CustomFolderDefinition, type CustomTabDefinition } from './examples';
import { ExpressionTree } from './ExpressionTree';
import { ExamplePopup } from './components/ExamplePopup';
import { ReferencePopup } from './components/ReferencePopup';
import { StatusMessage } from './components/StatusMessage';
import { PRIMITIVE_REFERENCE } from './reference';
import {
  STORAGE_KEY,
  type CustomTabState,
  type CustomFolderState,
  type PersistedSnapshot,
  createCustomTabId,
  createCustomFolderId,
  buildDefaultTabName,
  buildDefaultFolderName,
  createCustomTabsFromDefinitions,
  loadPersistedSnapshot,
  isValidTabName,
  LocalStorageExpressionCollectionResolver
} from './workspace';

const MIN_LEFT_WIDTH = 260;
const MIN_RIGHT_WIDTH = 320;
const MIN_TREE_WIDTH = 170;
const MIN_EDITOR_WIDTH = 360;
const DEFAULT_RATIO = 0.45;
const BACKGROUND_COLOR = '#0f172a';
const GRID_COLOR = 'rgba(148, 163, 184, 0.2)';
const MAIN_TAB_ID = 'main';
const VIEW_TAB_ID = 'view';

export type RenameTarget = { type: 'tab' | 'folder'; id: string };

type ExpressionEntry =
  | { kind: 'tab'; createdAt: number; tab: CustomTabState }
  | { kind: 'folder'; createdAt: number; folder: CustomFolderState };

type ExampleWorkspaceDefinition = {
  tabs: CustomTabDefinition[];
  folders?: CustomFolderDefinition[];
};

const createWorkspaceStateFromDefinitions = (
  definitions?: ExampleWorkspaceDefinition | null
): { tabs: CustomTabState[]; folders: CustomFolderState[] } => {
  if (!definitions) {
    return { tabs: [], folders: [] };
  }
  let tabIndex = 0;
  let folderIndex = 0;
  const tabs: CustomTabState[] = [];
  const folders: CustomFolderState[] = [];

  const addTabs = (items: CustomTabDefinition[] | undefined, folderId: string | null) => {
    if (!items) {
      return;
    }
    for (const definition of items) {
      tabs.push({
        id: createCustomTabId(),
        name: definition.name,
        expression: definition.expression,
        folderId,
        createdAt: tabIndex
      });
      tabIndex += 1;
    }
  };

  const addFolder = (definition: CustomFolderDefinition, parentId: string | null) => {
    const folderId = createCustomFolderId();
    folders.push({
      id: folderId,
      name: definition.name,
      parentId,
      createdAt: folderIndex
    });
    folderIndex += 1;
    addTabs(definition.tabs, folderId);
    for (const child of definition.folders ?? []) {
      addFolder(child, folderId);
    }
  };

  addTabs(definitions.tabs, null);
  for (const folder of definitions.folders ?? []) {
    addFolder(folder, null);
  }

  return { tabs, folders };
};

const getExpressionTabButtonId = (tabId: string) => {
  if (tabId === MAIN_TAB_ID) {
    return 'main-expression-tab';
  }
  if (tabId === VIEW_TAB_ID) {
    return 'view-expression-tab';
  }
  return `custom-expression-tab-${tabId}`;
};

const getExpressionTabPanelId = (tabId: string) => {
  if (tabId === MAIN_TAB_ID) {
    return 'main-expression-panel';
  }
  if (tabId === VIEW_TAB_ID) {
    return 'view-expression-panel';
  }
  return `custom-expression-panel-${tabId}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const drawScene = (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  extent: ViewExtent | null,
  graphics: PreparedGraphics,
  renderWarnings: string[],
  padding: number
) => {
  const { width: pixelWidth, height: pixelHeight } = canvas;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, pixelWidth, pixelHeight);
  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, pixelWidth, pixelHeight);

  if (!extent || graphics.layers.length === 0) {
    return;
  }

  const projector = projectPointBuilder(extent, pixelWidth, pixelHeight, padding);
  const { project, scale } = projector;

  const applyStroke = (stroke: string | null, width: number) => {
    context.lineWidth = Math.max(1, width * scale);
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.strokeStyle = stroke ?? '#e2e8f0';
  };

  const drawAxes = () => {
    context.save();
    context.setLineDash([4, 6]);
    context.lineWidth = 1;
    context.strokeStyle = GRID_COLOR;
    context.beginPath();
    if (extent.minY <= 0 && extent.maxY >= 0) {
      const left = project([extent.minX, 0]);
      const right = project([extent.maxX, 0]);
      context.moveTo(left.x, left.y);
      context.lineTo(right.x, right.y);
    }
    if (extent.minX <= 0 && extent.maxX >= 0) {
      const bottom = project([0, extent.minY]);
      const top = project([0, extent.maxY]);
      context.moveTo(bottom.x, bottom.y);
      context.lineTo(top.x, top.y);
    }
    context.stroke();
    context.restore();
  };

  const drawPrimitive = (primitive: PreparedPrimitive) => {
    switch (primitive.type) {
      case 'line': {
        const start = project(primitive.from);
        const end = project(primitive.to);
        context.save();
        applyStroke(primitive.stroke, primitive.width);
        if (primitive.dash && primitive.dash.length > 0) {
          context.setLineDash(primitive.dash.map((segment) => Math.max(0, segment) * scale));
        } else {
          context.setLineDash([]);
        }
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
        context.restore();
        break;
      }
      case 'rect': {
        const [x, y] = primitive.position;
        const [w, h] = primitive.size;
        const projected = [
          project([x, y]),
          project([x + w, y]),
          project([x + w, y + h]),
          project([x, y + h])
        ];
        context.save();
        context.beginPath();
        projected.forEach((point, index) => {
          if (index === 0) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        });
        context.closePath();
        if (primitive.fill) {
          context.fillStyle = primitive.fill;
          context.fill();
        }
        if (primitive.stroke && primitive.width > 0) {
          applyStroke(primitive.stroke, primitive.width);
          context.stroke();
        }
        context.restore();
        break;
      }
      case 'circle': {
        const center = project(primitive.center);
        context.save();
        context.beginPath();
        context.arc(center.x, center.y, Math.max(0, primitive.radius * scale), 0, Math.PI * 2);
        if (primitive.fill) {
          context.fillStyle = primitive.fill;
          context.fill();
        }
        if (primitive.stroke && primitive.width > 0) {
          applyStroke(primitive.stroke, primitive.width);
          context.stroke();
        }
        context.restore();
        break;
      }
      case 'polygon': {
        if (primitive.points.length < 3) {
          return;
        }
        const projected = primitive.points.map(project);
        context.save();
        context.beginPath();
        projected.forEach((point, index) => {
          if (index === 0) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        });
        context.closePath();
        if (primitive.fill) {
          context.fillStyle = primitive.fill;
          context.fill();
        }
        if (primitive.stroke && primitive.width > 0) {
          applyStroke(primitive.stroke, primitive.width);
          context.stroke();
        }
        context.restore();
        break;
      }
      case 'text': {
        const projected = project(primitive.position);
        context.save();
        context.fillStyle = primitive.color;
        context.textAlign = primitive.align;
        context.textBaseline = 'middle';
        context.font = `${Math.max(12, primitive.fontSize * scale)}px "Inter", "Roboto", sans-serif`;
        context.fillText(primitive.text, projected.x, projected.y);
        context.restore();
        break;
      }
      default:
        break;
    }
  };

  drawAxes();

  for (const layer of graphics.layers) {
    for (const primitive of layer) {
      drawPrimitive(primitive);
    }
  }

};

const App = (): JSX.Element => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const bicycleExample = examples.find((entry) => entry.id === 'bicyle') ?? null;
  const initialExample = bicycleExample ?? (examples.length > 0 ? examples[0] : null);
  const persistedStateRef = useRef<PersistedSnapshot | null>(loadPersistedSnapshot());
  const defaultExampleWorkspaceRef = useRef<
    { tabs: CustomTabState[]; folders: CustomFolderState[] } | null
  >(
    initialExample
      ? createWorkspaceStateFromDefinitions({
          tabs: initialExample.customTabs,
          folders: initialExample.customFolders
        })
      : null
  );

  const [leftWidth, setLeftWidth] = useState(() => {
    const persisted = persistedStateRef.current;
    if (persisted && typeof persisted.leftWidth === 'number' && Number.isFinite(persisted.leftWidth)) {
      return Math.max(MIN_LEFT_WIDTH, Math.round(persisted.leftWidth));
    }
    if (typeof window === 'undefined') {
      return 420;
    }
    return Math.round(window.innerWidth * DEFAULT_RATIO) || 420;
  });
  const [dragging, setDragging] = useState(false);
  const [viewExpression, setViewExpression] = useState(() => {
    const persisted = persistedStateRef.current;
    if (persisted && typeof persisted.viewExpression === 'string') {
      return persisted.viewExpression;
    }
    return initialExample ? initialExample.view : defaultViewExpression;
  });
  const [graphicsExpression, setGraphicsExpression] = useState(() => {
    const persisted = persistedStateRef.current;
    if (persisted && typeof persisted.graphicsExpression === 'string') {
      return persisted.graphicsExpression;
    }
    return initialExample ? initialExample.graphics : defaultGraphicsExpression;
  });
  const [customTabs, setCustomTabs] = useState<CustomTabState[]>(() => {
    const persisted = persistedStateRef.current;
    if (persisted?.customTabs && Array.isArray(persisted.customTabs)) {
      return persisted.customTabs;
    }
    return defaultExampleWorkspaceRef.current?.tabs ?? [];
  });
  const [customFolders, setCustomFolders] = useState<CustomFolderState[]>(() => {
    const persisted = persistedStateRef.current;
    if (persisted?.customFolders && Array.isArray(persisted.customFolders)) {
      return persisted.customFolders;
    }
    return defaultExampleWorkspaceRef.current?.folders ?? [];
  });
  const [activeExpressionTab, setActiveExpressionTab] = useState<string>(() => {
    const persisted = persistedStateRef.current;
    const candidate = persisted?.activeExpressionTab;
    if (!candidate) {
      return MAIN_TAB_ID;
    }
    if (candidate === MAIN_TAB_ID || candidate === VIEW_TAB_ID) {
      return candidate;
    }
    const persistedCustomTabs = persisted?.customTabs ?? [];
    if (persistedCustomTabs.some((tab) => tab.id === candidate)) {
      return candidate;
    }
    return MAIN_TAB_ID;
  });
  const [tabNameDraft, setTabNameDraft] = useState<string | null>(null);
  const [tabDraftFolderId, setTabDraftFolderId] = useState<string | null>(null);
  const [tabNameDraftError, setTabNameDraftError] = useState<string | null>(null);
  const newTabInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFocusEditorId, setPendingFocusEditorId] = useState<string | null>(null);
  const newTabInputPrimedRef = useRef(false);
  const draftCommittedRef = useRef(false);
  const [treeWidth, setTreeWidth] = useState(() => {
    const persisted = persistedStateRef.current;
    if (persisted && typeof persisted.treeWidth === 'number' && Number.isFinite(persisted.treeWidth)) {
      return Math.max(MIN_TREE_WIDTH, Math.round(persisted.treeWidth));
    }
    return 220;
  });
  const [treeDragging, setTreeDragging] = useState(false);
  const expressionLayoutRef = useRef<HTMLDivElement | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => {
    const persisted = persistedStateRef.current;
    if (!persisted?.customFolders || persisted.customFolders.length === 0) {
      return new Set();
    }
    const expandedSet = persisted.expandedFolderIds ? new Set(persisted.expandedFolderIds) : null;
    if (!expandedSet) {
      return new Set();
    }
    const collapsed = new Set<string>();
    for (const folder of persisted.customFolders) {
      if (!expandedSet.has(folder.id)) {
        collapsed.add(folder.id);
      }
    }
    return collapsed;
  });

  const getContextNameSet = useCallback(
    (
      parentId: string | null,
      options?: { excludeTabId?: string; excludeFolderId?: string }
    ) => {
    const names = new Set<string>();
    if (parentId === null) {
      names.add(MAIN_TAB_ID);
      names.add(VIEW_TAB_ID);
    }
    for (const tab of customTabs) {
      if (tab.folderId === parentId && tab.id !== options?.excludeTabId) {
        names.add(tab.name.toLowerCase());
      }
    }
    for (const folder of customFolders) {
      const folderParent = folder.parentId ?? null;
      if (folderParent === parentId && folder.id !== options?.excludeFolderId) {
        names.add(folder.name.toLowerCase());
      }
    }
    return names;
    },
    [customFolders, customTabs]
  );

  const collectDescendantFolderIds = useCallback(
    (folderId: string): Set<string> => {
      const descendants = new Set<string>();
      const traverse = (id: string) => {
        for (const folder of customFolders) {
          if ((folder.parentId ?? null) === id) {
            descendants.add(folder.id);
            traverse(folder.id);
          }
        }
      };
      traverse(folderId);
      return descendants;
    },
    [customFolders]
  );

  useEffect(() => {
    if (tabNameDraft !== null) {
      if (!newTabInputPrimedRef.current && newTabInputRef.current) {
        newTabInputPrimedRef.current = true;
        newTabInputRef.current.focus();
        newTabInputRef.current.select();
      }
    } else {
      newTabInputPrimedRef.current = false;
      setTabDraftFolderId(null);
    }
  }, [tabNameDraft]);

  useEffect(() => {
    setCollapsedFolders((current) => {
      if (current.size === 0) {
        return current;
      }
      const validIds = new Set(customFolders.map((folder) => folder.id));
      let requiresUpdate = false;
      for (const id of current) {
        if (!validIds.has(id)) {
          requiresUpdate = true;
          break;
        }
      }
      if (!requiresUpdate) {
        return current;
      }
      const next = new Set<string>();
      for (const id of current) {
        if (validIds.has(id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [customFolders]);

  useEffect(() => {
    if (!pendingFocusEditorId) {
      return;
    }
    if (typeof document === 'undefined') {
      return;
    }
    const selector = `[data-editor-id="${pendingFocusEditorId}"] .cm-content`;
    const editorElement = document.querySelector(selector);
    if (editorElement instanceof HTMLElement) {
      editorElement.focus();
    }
    setPendingFocusEditorId(null);
  }, [pendingFocusEditorId]);
  const [renderWarnings, setRenderWarnings] = useState<string[]>([]);
  const [canvasSize, setCanvasSize] = useState<{ cssWidth: number; cssHeight: number; dpr: number }>(
    () => ({ cssWidth: 0, cssHeight: 0, dpr: 1 })
  );
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedExampleId, setSelectedExampleId] = useState<string>(() => {
    const persisted = persistedStateRef.current;
    const candidate = persisted?.selectedExampleId;
    if (candidate) {
      const validIds = new Set(examples.map((example) => example.id));
      if (candidate === 'custom' || validIds.has(candidate)) {
        return candidate;
      }
    }
    return initialExample ? initialExample.id : 'custom';
  });
  const [referenceSelection, setReferenceSelection] = useState<string>(() =>
    PRIMITIVE_REFERENCE.length > 0 ? PRIMITIVE_REFERENCE[0].name : ''
  );
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);

  const applyWidthFromClientX = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const clampedLeft = clamp(
        clientX - rect.left,
        MIN_LEFT_WIDTH,
        Math.max(MIN_LEFT_WIDTH, rect.width - MIN_RIGHT_WIDTH)
      );
      setLeftWidth(Math.round(clampedLeft));
    },
    []
  );

  const stopDragging = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!dragging) {
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      applyWidthFromClientX(event.clientX);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        applyWidthFromClientX(event.touches[0].clientX);
      }
    };

    const handlePointerUp = () => {
      stopDragging();
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('touchcancel', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
      window.removeEventListener('touchcancel', handlePointerUp);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
  }, [applyWidthFromClientX, dragging, stopDragging]);

  const handleSplitterMouseDown = useCallback(() => {
    setDragging(true);
  }, []);

  const handleSplitterTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
    if (event.touches.length > 0) {
      applyWidthFromClientX(event.touches[0].clientX);
    }
  }, [applyWidthFromClientX]);

  const clampTreeWidth = useCallback(() => {
    const container = expressionLayoutRef.current;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const maxWidth = Math.max(MIN_TREE_WIDTH, rect.width - MIN_EDITOR_WIDTH);
    setTreeWidth((current) => clamp(current, MIN_TREE_WIDTH, maxWidth));
  }, []);

  const applyTreeWidthFromClientX = useCallback(
    (clientX: number) => {
      const container = expressionLayoutRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const relative = clientX - rect.left;
      const maxWidth = Math.max(MIN_TREE_WIDTH, rect.width - MIN_EDITOR_WIDTH);
      const nextWidth = clamp(relative, MIN_TREE_WIDTH, maxWidth);
      setTreeWidth(nextWidth);
    },
    []
  );

  useEffect(() => {
    clampTreeWidth();
    window.addEventListener('resize', clampTreeWidth);
    return () => window.removeEventListener('resize', clampTreeWidth);
  }, [clampTreeWidth]);

  useEffect(() => {
    if (!treeDragging) {
      return;
    }
    const handleMouseMove = (event: MouseEvent) => {
      applyTreeWidthFromClientX(event.clientX);
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        applyTreeWidthFromClientX(event.touches[0].clientX);
      }
    };
    const handlePointerUp = () => {
      setTreeDragging(false);
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('touchcancel', handlePointerUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
      window.removeEventListener('touchcancel', handlePointerUp);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
  }, [applyTreeWidthFromClientX, treeDragging]);

  const handleTreeSplitterMouseDown = useCallback(() => {
    setTreeDragging(true);
  }, []);

  const handleTreeSplitterTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      event.preventDefault();
      setTreeDragging(true);
      if (event.touches.length > 0) {
        applyTreeWidthFromClientX(event.touches[0].clientX);
      }
    },
    [applyTreeWidthFromClientX]
  );

  const handleTreeSplitterKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const container = expressionLayoutRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const maxWidth = Math.max(MIN_TREE_WIDTH, rect.width - MIN_EDITOR_WIDTH);
      let delta = 0;
      if (event.key === 'ArrowLeft') {
        delta = -10;
      } else if (event.key === 'ArrowRight') {
        delta = 10;
      }
      if (delta !== 0) {
        event.preventDefault();
        setTreeWidth((current) => clamp(current + delta, MIN_TREE_WIDTH, maxWidth));
      }
    },
    []
  );

  const handleToggleFolderCollapse = useCallback((folderId: string) => {
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleEnsureFolderExpanded = useCallback((folderId: string | null) => {
    if (!folderId) {
      return;
    }
    setCollapsedFolders((current) => {
      if (!current.has(folderId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(folderId);
      return next;
    });
  }, []);

  const handleExpandAllFolders = useCallback(() => {
    setCollapsedFolders(new Set());
  }, []);

  const handleCollapseAllFolders = useCallback(() => {
    setCollapsedFolders(new Set(customFolders.map((folder) => folder.id)));
  }, [customFolders]);

  const handleReferenceOpen = useCallback(() => {
    setReferenceSelection((current) => {
      if (PRIMITIVE_REFERENCE.some((entry) => entry.name === current)) {
        return current;
      }
      return PRIMITIVE_REFERENCE[0]?.name ?? '';
    });
    setReferenceOpen(true);
  }, []);

  const handleReferenceClose = useCallback(() => {
    setReferenceOpen(false);
  }, []);

  const handleReferenceSelectionChange = useCallback((value: string) => {
    setReferenceSelection(value);
  }, []);

  const handleExampleOpen = useCallback(() => {
    setExampleOpen(true);
  }, []);

  const handleExampleClose = useCallback(() => {
    setExampleOpen(false);
  }, []);

  const handleExampleLoad = useCallback(
    (exampleId: string) => {
      if (!examples.some((entry) => entry.id === exampleId)) {
        return;
      }
      setExampleOpen(false);
      setActiveExpressionTab(MAIN_TAB_ID);
      setTabNameDraft(null);
      setTabDraftFolderId(null);
      setSelectedExampleId(exampleId);
    },
    []
  );

  const handleViewExpressionChange = useCallback(
    (value: string) => {
      setViewExpression(value);
      if (selectedExampleId !== 'custom') {
        setSelectedExampleId('custom');
      }
    },
    [selectedExampleId]
  );

  const handleGraphicsExpressionChange = useCallback(
    (value: string) => {
      setGraphicsExpression(value);
      if (selectedExampleId !== 'custom') {
        setSelectedExampleId('custom');
      }
    },
    [selectedExampleId]
  );

  const handleExpressionTabSelect = useCallback((tabId: string) => {
    setActiveExpressionTab(tabId);
  }, []);

  const handleCustomTabExpressionChange = useCallback((tabId: string, next: string) => {
    setCustomTabs((current) => current.map((tab) => (tab.id === tabId ? { ...tab, expression: next } : tab)));
    setSelectedExampleId((current) => (current === 'custom' ? current : 'custom'));
  }, []);

  const handleAddTabClick = useCallback(
    (folderId: string | null = null) => {
      if (tabNameDraft !== null) {
        if (newTabInputRef.current) {
          newTabInputRef.current.focus();
          newTabInputRef.current.select();
        }
        return;
      }
      const existingNames = getContextNameSet(folderId);
      const defaultName = buildDefaultTabName(existingNames);
      setTabDraftFolderId(folderId);
      setTabNameDraft(defaultName);
      setTabNameDraftError(null);
      draftCommittedRef.current = false;
    },
    [customFolders, customTabs, getContextNameSet, tabNameDraft]
  );

  const handleCancelTabDraft = useCallback(() => {
    setTabNameDraft(null);
    setTabNameDraftError(null);
    setTabDraftFolderId(null);
  }, []);

  const handleAddFolderClick = useCallback(
    (parentId: string | null = null): CustomFolderState => {
      const existingNames = getContextNameSet(parentId);
      const defaultName = buildDefaultFolderName(existingNames);
      const newFolder: CustomFolderState = {
        id: createCustomFolderId(),
        name: defaultName,
        parentId,
        createdAt: Date.now()
      };
      setCustomFolders((current) => [...current, newFolder]);
      setSelectedExampleId((current) => (current === 'custom' ? current : 'custom'));
      handleCancelTabDraft();
      return newFolder;
    },
    [getContextNameSet, handleCancelTabDraft, setCustomFolders, setSelectedExampleId]
  );

  const handleRenameTab = useCallback(
    (tabId: string, nextName: string) => {
      setCustomTabs((current) =>
        current.map((tab) => (tab.id === tabId ? { ...tab, name: nextName } : tab))
      );
      setSelectedExampleId((current) => (current === 'custom' ? current : 'custom'));
      if (activeExpressionTab === tabId) {
        setPendingFocusEditorId(tabId);
      }
    },
    [activeExpressionTab]
  );

  const handleRenameFolder = useCallback((folderId: string, nextName: string) => {
    setCustomFolders((current) =>
      current.map((folder) => (folder.id === folderId ? { ...folder, name: nextName } : folder))
    );
    setSelectedExampleId((current) => (current === 'custom' ? current : 'custom'));
  }, []);


  const handleRemoveTab = useCallback((tabId: string) => {
    setCustomTabs((current) => current.filter((tab) => tab.id !== tabId));
    setSelectedExampleId((current) => (current === 'custom' ? current : 'custom'));
    setActiveExpressionTab((current) => (current === tabId ? MAIN_TAB_ID : current));
  }, []);

  const handleRemoveFolder = useCallback(
    (folderId: string) => {
      const descendantIds = collectDescendantFolderIds(folderId);
      const allFolderIds = new Set<string>([folderId, ...descendantIds]);
      const removedTabIds = new Set<string>();
      for (const tab of customTabs) {
        if (tab.folderId && allFolderIds.has(tab.folderId)) {
          removedTabIds.add(tab.id);
        }
      }
      setCustomFolders((current) => current.filter((folder) => !allFolderIds.has(folder.id)));
      setCustomTabs((current) => current.filter((tab) => !tab.folderId || !allFolderIds.has(tab.folderId)));
      setSelectedExampleId((current) => (current === 'custom' ? current : 'custom'));
      if (tabDraftFolderId && allFolderIds.has(tabDraftFolderId)) {
        handleCancelTabDraft();
      }
      setActiveExpressionTab((current) =>
        removedTabIds.has(current) ? MAIN_TAB_ID : current
      );
    },
    [collectDescendantFolderIds, customTabs, handleCancelTabDraft, tabDraftFolderId]
  );

  const commitCustomTabDraft = useCallback(
    (rawName?: string) => {
      if (tabNameDraft === null) {
        return false;
      }
      const inputName = rawName ?? tabNameDraft;
      const trimmedName = inputName.trim();
      if (!trimmedName) {
        setTabNameDraftError('Name is required.');
        return false;
      }
      if (!isValidTabName(trimmedName)) {
        setTabNameDraftError('Use letters, digits, or underscores; start with a letter or underscore.');
        return false;
      }
      const lowerName = trimmedName.toLowerCase();
      const existingNames = getContextNameSet(tabDraftFolderId);
      if (existingNames.has(lowerName)) {
        setTabNameDraftError('That name is already in use.');
        return false;
      }

      const newTab: CustomTabState = {
        id: createCustomTabId(),
        name: trimmedName,
        expression: '{\n  return 0;\n}',
        folderId: tabDraftFolderId,
        createdAt: Date.now()
      };
      setCustomTabs((current) => [...current, newTab]);
      setActiveExpressionTab(newTab.id);
      setTabNameDraft(null);
      setTabDraftFolderId(null);
      setTabNameDraftError(null);
      setPendingFocusEditorId(newTab.id);
      draftCommittedRef.current = true;
      return true;
    },
    [customFolders, customTabs, getContextNameSet, tabDraftFolderId, tabNameDraft]
  );

  const handleTabNameDraftChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setTabNameDraft(event.target.value);
    setTabNameDraftError(null);
    draftCommittedRef.current = false;
  }, []);

  const handleTabNameDraftKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const committed = commitCustomTabDraft(event.currentTarget.value);
        if (committed && event.currentTarget) {
          event.currentTarget.blur();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handleCancelTabDraft();
      }
    },
    [commitCustomTabDraft, handleCancelTabDraft]
  );

  const handleTabNameDraftBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (draftCommittedRef.current) {
        draftCommittedRef.current = false;
        return;
      }
      const committed = commitCustomTabDraft(event.currentTarget.value);
      if (!committed) {
        requestAnimationFrame(() => {
          if (newTabInputRef.current) {
            newTabInputRef.current.focus();
            newTabInputRef.current.select();
          }
        });
      }
    },
    [commitCustomTabDraft]
  );

  const handleSplitterKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const containerWidth = container ? container.getBoundingClientRect().width : window.innerWidth;
    const maxLeft = Math.max(MIN_LEFT_WIDTH, containerWidth - MIN_RIGHT_WIDTH);
    const step = event.shiftKey ? 32 : 12;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setLeftWidth((current) => clamp(current - step, MIN_LEFT_WIDTH, maxLeft));
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setLeftWidth((current) => clamp(current + step, MIN_LEFT_WIDTH, maxLeft));
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setLeftWidth(MIN_LEFT_WIDTH);
    }
    if (event.key === 'End') {
      event.preventDefault();
      setLeftWidth(maxLeft);
    }
  }, []);

  useEffect(() => {
    if ((!referenceOpen && !exampleOpen) || typeof window === 'undefined') {
      return;
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (referenceOpen) {
          setReferenceOpen(false);
        }
        if (exampleOpen) {
          setExampleOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exampleOpen, referenceOpen]);

  useEffect(() => {
    if ((!referenceOpen && !exampleOpen) || typeof document === 'undefined') {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [exampleOpen, referenceOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const expandedFolderIds = customFolders
      .map((folder) => folder.id)
      .filter((folderId) => !collapsedFolders.has(folderId));
    const snapshot: PersistedSnapshot = {
      leftWidth,
      selectedExampleId,
      graphicsExpression,
      viewExpression,
      customTabs,
      customFolders,
      activeExpressionTab,
      treeWidth,
      expandedFolderIds
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Swallow storage errors to avoid breaking the editor experience.
    }
  }, [
    activeExpressionTab,
    customFolders,
    customTabs,
    graphicsExpression,
    leftWidth,
    collapsedFolders,
    treeWidth,
    selectedExampleId,
    viewExpression
  ]);

  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const maxLeft = Math.max(MIN_LEFT_WIDTH, rect.width - MIN_RIGHT_WIDTH);
      setLeftWidth((width) => clamp(width, MIN_LEFT_WIDTH, maxLeft));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const resolver = useMemo(
    () => new LocalStorageExpressionCollectionResolver(STORAGE_KEY, { tabs: customTabs, folders: customFolders }),
    [customTabs, customFolders]
  );

  const evaluationState = useMemo(() => {
    const baseProvider = prepareProvider();
    const funcDraw = FuncDraw.evaluate(resolver, time, { baseProvider });
    const environmentProvider = funcDraw.environmentProvider;

    const evaluationMap = new Map<string, EvaluationResult>();

    for (const tab of customTabs) {
      const path = resolver.getPathForTab(tab.id);
      if (!path) {
        continue;
      }
      const result = funcDraw.evaluateExpression(path);
      if (result) {
        evaluationMap.set(tab.id, result);
      }
    }

    const viewResult = evaluateExpression(environmentProvider, viewExpression);
    environmentProvider.setNamedValue('view', viewResult.typed ?? null);
    const graphicsResult = evaluateExpression(environmentProvider, graphicsExpression);

    return {
      customEvaluations: evaluationMap,
      viewEvaluation: viewResult,
      graphicsEvaluation: graphicsResult
    };
  }, [customTabs, graphicsExpression, resolver, time, viewExpression]);

  const customTabEvaluations = evaluationState.customEvaluations;
  const viewEvaluation = evaluationState.viewEvaluation;
  const graphicsEvaluation = evaluationState.graphicsEvaluation;

  const entriesByParent = useMemo(() => {
    const map = new Map<string | null, ExpressionEntry[]>();
    const addEntry = (parent: string | null, entry: ExpressionEntry) => {
      const key = parent ?? null;
      const list = map.get(key);
      if (list) {
        list.push(entry);
      } else {
        map.set(key, [entry]);
      }
    };

    for (const tab of customTabs) {
      addEntry(tab.folderId ?? null, { kind: 'tab', createdAt: tab.createdAt, tab });
    }
    for (const folder of customFolders) {
      addEntry(folder.parentId ?? null, { kind: 'folder', createdAt: folder.createdAt, folder });
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.createdAt - b.createdAt);
    }
    return map;
  }, [customFolders, customTabs]);

  const viewInterpretation = useMemo(() => interpretView(viewEvaluation.value), [viewEvaluation.value]);

  const graphicsInterpretation = useMemo(() => interpretGraphics(graphicsEvaluation.value), [
    graphicsEvaluation.value
  ]);

  const preparedGraphics = useMemo(
    () => prepareGraphics(viewInterpretation.extent, graphicsInterpretation.layers),
    [viewInterpretation.extent, graphicsInterpretation.layers]
  );

  const drawStateRef = useRef<{ preparedGraphics: PreparedGraphics; extent: ViewExtent | null }>({
    preparedGraphics,
    extent: viewInterpretation.extent
  });
  const rafRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const playingRef = useRef(false);

  const requestFrame = useCallback((force?: boolean) => {
    if (rafRef.current !== null) {
      if (force) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      } else {
        return;
      }
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }
      const { preparedGraphics: latestGraphics, extent } = drawStateRef.current;
      const warnings: string[] = [];
      drawScene(canvas, context, extent, latestGraphics, warnings, 48);
      setRenderWarnings(warnings);
    });
  }, [setRenderWarnings]);

  const drawImmediate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    const { preparedGraphics: latestGraphics, extent } = drawStateRef.current;
    const warnings: string[] = [];
    drawScene(canvas, context, extent, latestGraphics, warnings, 48);
    setRenderWarnings(warnings);
  }, [setRenderWarnings]);

  const animationLoop = useCallback(
    function animationLoop(timestamp: number) {
      if (!playingRef.current) {
        animationFrameRef.current = null;
        return;
      }
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }
      const deltaSeconds = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;
      setTime((previous) => previous + deltaSeconds);
      animationFrameRef.current = window.requestAnimationFrame(animationLoop);
    },
    []
  );

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    lastTimestampRef.current = null;
  }, []);

  const handlePlay = useCallback(() => {
    if (playingRef.current) {
      return;
    }
    playingRef.current = true;
    setIsPlaying(true);
    lastTimestampRef.current = null;
    animationFrameRef.current = window.requestAnimationFrame(animationLoop);
  }, [animationLoop]);

  const handlePause = useCallback(() => {
    if (!playingRef.current) {
      return;
    }
    playingRef.current = false;
    setIsPlaying(false);
    stopAnimation();
  }, [stopAnimation]);

  const handleReset = useCallback(() => {
    playingRef.current = false;
    setIsPlaying(false);
    stopAnimation();
    setTime(0);
    drawImmediate();
  }, [stopAnimation, drawImmediate]);

  const handleClear = useCallback(() => {
    playingRef.current = false;
    setIsPlaying(false);
    stopAnimation();
    setTime(0);
    setSelectedExampleId('custom');
    setViewExpression(defaultViewExpression);
    setGraphicsExpression(`{\n  return []; // See reference for supported primitives.\n}`);
    setCustomTabs([]);
    setCustomFolders([]);
    setActiveExpressionTab(MAIN_TAB_ID);
    drawImmediate();
  }, [drawImmediate, stopAnimation]);

  useEffect(() => {
    if (selectedExampleId === 'custom') {
      return;
    }
    const example = examples.find((entry) => entry.id === selectedExampleId);
    if (!example) {
      return;
    }
    playingRef.current = false;
    setIsPlaying(false);
    stopAnimation();
    setTime(0);
    setViewExpression(example.view);
    setGraphicsExpression(example.graphics);
    const workspace = createWorkspaceStateFromDefinitions({
      tabs: example.customTabs,
      folders: example.customFolders
    });
    setCustomTabs(workspace.tabs);
    setCustomFolders(workspace.folders);
    setTabNameDraft(null);
    setTabDraftFolderId(null);
    setActiveExpressionTab(MAIN_TAB_ID);
  }, [selectedExampleId, stopAnimation]);

  useEffect(() => {
    drawStateRef.current = {
      preparedGraphics,
      extent: viewInterpretation.extent
    };
    if (canvasRef.current) {
      requestFrame(true);
      drawImmediate();
    }
  }, [preparedGraphics, viewInterpretation.extent, requestFrame, drawImmediate]);

  useEffect(() => () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  useEffect(() => () => {
    stopAnimation();
  }, [stopAnimation]);

  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) {
      return;
    }

    const updateCanvasSize = () => {
      const rect = wrapper.getBoundingClientRect();
      const cssWidth = Math.max(1, rect.width);
      const cssHeight = Math.max(1, rect.height);
      const dpr = window.devicePixelRatio || 1;
      const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
      const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      if (canvas.style.width !== `${cssWidth}px`) {
        canvas.style.width = `${cssWidth}px`;
      }
      if (canvas.style.height !== `${cssHeight}px`) {
        canvas.style.height = `${cssHeight}px`;
      }

      setCanvasSize((current) => {
        if (
          Math.abs(current.cssWidth - cssWidth) < 0.5 &&
          Math.abs(current.cssHeight - cssHeight) < 0.5 &&
          current.dpr === dpr
        ) {
          return current;
        }
        return { cssWidth, cssHeight, dpr };
      });

      requestFrame();
    };

    updateCanvasSize();

    const observer = new ResizeObserver(() => {
      updateCanvasSize();
    });
    observer.observe(wrapper);

    return () => {
      observer.disconnect();
    };
  }, [requestFrame]);

  const unknownTypesWarning =
    graphicsInterpretation.unknownTypes.length > 0
      ? `Unknown primitive type(s): ${graphicsInterpretation.unknownTypes.join(', ')}`
      : null;

  const totalPrimitives = useMemo(() => {
    if (preparedGraphics.layers.length === 0) {
      return 0;
    }
    return preparedGraphics.layers.reduce((sum, layer) => sum + layer.length, 0);
  }, [preparedGraphics.layers]);

  const canvasReady =
    canvasSize.cssWidth > 0 &&
    canvasSize.cssHeight > 0 &&
    preparedGraphics.layers.length > 0 &&
    viewInterpretation.extent !== null;

  const isMainTabActive = activeExpressionTab === MAIN_TAB_ID;
  const isViewTabActive = activeExpressionTab === VIEW_TAB_ID;

  return (
    <>
      <div ref={containerRef} className="app" aria-label="FuncScript graphics workspace">
        <section className="panel panel-left" style={{ width: `${leftWidth}px` }}>
          <div className="panel-body panel-body-right">
            <div className="top-controls">
              <div className="app-title-group">
                <span className="app-icon" aria-hidden="true">
                  <span className="app-icon-triangle" />
                  <span className="app-icon-circle" />
                  <span className="app-icon-line" />
                </span>
                <h1 className="app-title" aria-label="FuncDraw application title">
                  <span className="app-title-func">Func</span>
                  <span className="app-title-draw">Draw</span>
                </h1>
              </div>
              <div className="top-controls-actions" role="group" aria-label="Workspace actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={handleClear}
                  aria-label="Clear workspace"
                  title="Clear workspace"
                >
                  <span aria-hidden="true">🧹</span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={handleExampleOpen}
                  aria-haspopup="dialog"
                  aria-expanded={exampleOpen}
                  aria-label="Load example"
                  title="Load example"
                >
                  <span aria-hidden="true">📂</span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={handleReferenceOpen}
                  aria-haspopup="dialog"
                  aria-expanded={referenceOpen}
                  aria-label="Open reference"
                  title="Open reference"
                >
                  <span aria-hidden="true">❔</span>
                </button>
              </div>
            </div>

            <div
              className="expression-tabs"
              ref={expressionLayoutRef}
              style={{ gridTemplateColumns: `${Math.round(treeWidth)}px 12px 1fr` }}
            >
              <ExpressionTree
                mainTabId={MAIN_TAB_ID}
                viewTabId={VIEW_TAB_ID}
                isMainTabActive={isMainTabActive}
                isViewTabActive={isViewTabActive}
                activeExpressionTab={activeExpressionTab}
                entriesByParent={entriesByParent}
                tabEvaluations={customTabEvaluations}
                tabNameDraft={tabNameDraft}
                tabDraftFolderId={tabDraftFolderId}
                tabNameDraftError={tabNameDraftError}
                newTabInputRef={newTabInputRef}
                getButtonId={getExpressionTabButtonId}
                getPanelId={getExpressionTabPanelId}
                collapsedFolders={collapsedFolders}
                onSelectTab={handleExpressionTabSelect}
                onAddTab={handleAddTabClick}
                onAddFolder={handleAddFolderClick}
                onTabDraftChange={handleTabNameDraftChange}
                onTabDraftKeyDown={handleTabNameDraftKeyDown}
                onTabDraftBlur={handleTabNameDraftBlur}
                onCancelTabDraft={handleCancelTabDraft}
                onRenameTab={handleRenameTab}
                onRenameFolder={handleRenameFolder}
                onRemoveTab={handleRemoveTab}
                onRemoveFolder={handleRemoveFolder}
                onToggleFolderCollapse={handleToggleFolderCollapse}
                onEnsureFolderExpanded={handleEnsureFolderExpanded}
                onExpandAllFolders={handleExpandAllFolders}
                onCollapseAllFolders={handleCollapseAllFolders}
              />
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize tree"
                tabIndex={0}
                className={`expression-inner-splitter${
                  treeDragging ? ' expression-inner-splitter-dragging' : ''
                }`}
                onMouseDown={handleTreeSplitterMouseDown}
                onTouchStart={handleTreeSplitterTouchStart}
                onKeyDown={handleTreeSplitterKeyDown}
              />
              <div className="expression-tab-panels">
                <div
                  role="tabpanel"
                  id={getExpressionTabPanelId(MAIN_TAB_ID)}
                  aria-labelledby={getExpressionTabButtonId(MAIN_TAB_ID)}
                  hidden={activeExpressionTab !== MAIN_TAB_ID}
                  className="expression-tab-panel"
                >
                  <div
                    className="editor-container editor-container-fill"
                    data-editor-id={MAIN_TAB_ID}
                    id="main-expression-editor"
                    aria-label="Main expression editor"
                  >
                    <FuncScriptEditor
                      value={graphicsExpression}
                      onChange={handleGraphicsExpressionChange}
                      minHeight={0}
                      style={{ flex: 1 }}
                    />
                  </div>
                    <StatusMessage
                      error={graphicsEvaluation.error}
                      warning={graphicsInterpretation.warning ?? unknownTypesWarning}
                      info={preparedGraphics.warnings.concat(renderWarnings)}
                      success={preparedGraphics.layers.length > 0 ? 'Main ready.' : null}
                    />
                </div>
                <div
                  role="tabpanel"
                  id={getExpressionTabPanelId(VIEW_TAB_ID)}
                  aria-labelledby={getExpressionTabButtonId(VIEW_TAB_ID)}
                  hidden={activeExpressionTab !== VIEW_TAB_ID}
                  className="expression-tab-panel"
                >
                  <div
                    className="editor-container editor-container-fill"
                    data-editor-id={VIEW_TAB_ID}
                    id="view-expression-editor"
                    aria-label="View expression editor"
                  >
                    <FuncScriptEditor
                      value={viewExpression}
                      onChange={handleViewExpressionChange}
                      minHeight={0}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <StatusMessage
                    error={viewEvaluation.error}
                    warning={viewInterpretation.warning}
                    success={viewInterpretation.extent ? 'Extent ready.' : null}
                  />
                </div>
                {customTabs.map((tab) => {
                  const panelId = getExpressionTabPanelId(tab.id);
                  const buttonId = getExpressionTabButtonId(tab.id);
                  const evaluation = customTabEvaluations.get(tab.id);
                  return (
                    <div
                      key={tab.id}
                      role="tabpanel"
                      id={panelId}
                      aria-labelledby={buttonId}
                      hidden={activeExpressionTab !== tab.id}
                      className="expression-tab-panel"
                    >
                      <div
                        className="editor-container editor-container-fill"
                        data-editor-id={tab.id}
                        id={`custom-expression-editor-${tab.id}`}
                        aria-label={`${tab.name} expression editor`}
                      >
                        <FuncScriptEditor
                          value={tab.expression}
                          onChange={(value: string) => handleCustomTabExpressionChange(tab.id, value)}
                          minHeight={0}
                          style={{ flex: 1 }}
                        />
                      </div>
                      <StatusMessage
                        error={evaluation?.error ?? null}
                        success={!evaluation?.error ? 'Value ready.' : null}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
          tabIndex={0}
          className={`splitter${dragging ? ' splitter-dragging' : ''}`}
          onMouseDown={handleSplitterMouseDown}
          onTouchStart={handleSplitterTouchStart}
          onKeyDown={handleSplitterKeyDown}
        />

        <section className="panel panel-right">
          <div className="panel-body panel-body-left">
          <div className="panel-header-controls">
            <div className="panel-meta">
              <span>Primitives: {totalPrimitives}</span>
              <span>
                Canvas: {Math.round(canvasSize.cssWidth)}px × {Math.round(canvasSize.cssHeight)}px @ {canvasSize.dpr.toFixed(2)}x
              </span>
              <span>
                View span:{' '}
                {viewInterpretation.extent
                  ? `${(viewInterpretation.extent.maxX - viewInterpretation.extent.minX).toFixed(2)} × ${(viewInterpretation.extent.maxY - viewInterpretation.extent.minY).toFixed(2)}`
                  : '—'}
              </span>
              <span className="time-display">t = {time.toFixed(2)}s</span>
            </div>
            <div className="animation-controls">
              <div className="animation-buttons">
                <button
                  type="button"
                    className="control-button"
                    onClick={handlePlay}
                    disabled={isPlaying}
                    aria-label="Play"
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    className="control-button"
                    onClick={handlePause}
                    disabled={!isPlaying}
                    aria-label="Pause"
                  >
                    ⏸
                  </button>
                  <button
                    type="button"
                    className="control-button"
                    onClick={handleReset}
                    aria-label="Reset"
                  >
                    ⟲
                  </button>
                </div>
              </div>
            </div>

            <div ref={canvasWrapperRef} className="canvas-wrapper">
              <canvas ref={canvasRef} className="preview-canvas" />
              {!canvasReady ? (
                <div className="canvas-notice">
                  <p>Awaiting view extent and primitive output.</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
      <ReferencePopup
        open={referenceOpen}
        selection={referenceSelection}
        onSelect={handleReferenceSelectionChange}
        onClose={handleReferenceClose}
      />
      <ExamplePopup
        open={exampleOpen}
        currentId={selectedExampleId === 'custom' ? null : selectedExampleId}
        onSelect={handleExampleLoad}
        onClose={handleExampleClose}
      />
    </>
  );
};

export default App;
