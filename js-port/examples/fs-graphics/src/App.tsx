import {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import './App.css';
import { FuncScriptEditor } from '@tewelde/funcscript-editor';
import {
  defaultGraphicsExpression,
  defaultViewExpression,
  evaluateExpression,
  interpretGraphics,
  interpretView,
  prepareGraphics,
  prepareProvider,
  type EvaluationResult
} from './graphics';
import type { PreparedGraphics, ViewExtent } from './graphics';
import { drawScene } from './drawScene';
import { ExamplePopup } from './components/ExamplePopup';
import { ReferencePopup } from './components/ReferencePopup';
import { StatusMessage } from './components/StatusMessage';
import { CancelIcon, ConfirmIcon, DeleteIcon, RenameIcon } from './icons';
import { PRIMITIVE_REFERENCE } from './reference';
import {
  STORAGE_KEY,
  WorkspaceEvaluationManager,
  buildDefaultFolderName,
  buildDefaultTabName,
  createCustomFolderId,
  createCustomTabId,
  createCustomTabsFromDefinitions,
  isValidTabName,
  loadPersistedSnapshot,
  type CustomFolderState,
  type CustomTabState,
  type PersistedSnapshot
} from './workspace';
import examples from './examples';

const MIN_LEFT_WIDTH = 260;
const MIN_RIGHT_WIDTH = 320;
const DEFAULT_RATIO = 0.45;
const MAIN_TAB_ID = 'main';
const VIEW_TAB_ID = 'view';

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

const App = (): JSX.Element => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const bicycleExample = examples.find((entry) => entry.id === 'bicyle') ?? null;
  const initialExample = bicycleExample ?? (examples.length > 0 ? examples[0] : null);
  const persistedStateRef = useRef<PersistedSnapshot | null>(loadPersistedSnapshot());

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
    if (initialExample?.customTabs && initialExample.customTabs.length > 0) {
      return createCustomTabsFromDefinitions(initialExample.customTabs);
    }
    return [];
  });
  const [customFolders, setCustomFolders] = useState<CustomFolderState[]>(() => {
    const persisted = persistedStateRef.current;
    if (persisted?.customFolders && Array.isArray(persisted.customFolders)) {
      return persisted.customFolders;
    }
    return [];
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
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ type: 'tab' | 'folder'; id: string } | null>(
    null
  );
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameCommittedRef = useRef(false);

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
    if (!renameTarget) {
      return;
    }
    requestAnimationFrame(() => {
      if (renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
      }
    });
  }, [renameTarget]);

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
      const existingNames = new Set<string>([MAIN_TAB_ID, VIEW_TAB_ID]);
      for (const tab of customTabs) {
        existingNames.add(tab.name.toLowerCase());
      }
      if (!folderId) {
        for (const folder of customFolders) {
          existingNames.add(folder.name.toLowerCase());
        }
      }
      const defaultName = buildDefaultTabName(existingNames);
      setTabDraftFolderId(folderId);
      setTabNameDraft(defaultName);
      setTabNameDraftError(null);
      draftCommittedRef.current = false;
    },
    [customFolders, customTabs, tabNameDraft]
  );

  const handleAddFolderClick = useCallback(() => {
    const existingNames = new Set<string>();
    for (const folder of customFolders) {
      existingNames.add(folder.name.toLowerCase());
    }
    for (const tab of customTabs) {
      if (!tab.folderId) {
        existingNames.add(tab.name.toLowerCase());
      }
    }
    const defaultName = buildDefaultFolderName(existingNames);
    const newFolder: CustomFolderState = {
      id: createCustomFolderId(),
      name: defaultName
    };
    setCustomFolders((current) => [...current, newFolder]);
    setSelectedExampleId((current) => (current === 'custom' ? current : 'custom'));
  }, [customFolders, customTabs, setCustomFolders, setSelectedExampleId]);

  const cancelRename = useCallback(() => {
    setRenameTarget(null);
    setRenameDraft('');
    setRenameError(null);
    renameCommittedRef.current = false;
  }, []);

  const handleRenameTabStart = useCallback(
    (tab: CustomTabState) => {
      setTabNameDraft(null);
      setTabNameDraftError(null);
      setTabDraftFolderId(null);
      setRenameTarget({ type: 'tab', id: tab.id });
      setRenameDraft(tab.name);
      setRenameError(null);
      renameCommittedRef.current = false;
    },
    []
  );

  const handleRenameFolderStart = useCallback(
    (folder: CustomFolderState) => {
      setTabNameDraft(null);
      setTabNameDraftError(null);
      setTabDraftFolderId(null);
      setRenameTarget({ type: 'folder', id: folder.id });
      setRenameDraft(folder.name);
      setRenameError(null);
      renameCommittedRef.current = false;
    },
    []
  );

  const commitRename = useCallback(
    (rawValue?: string) => {
      if (!renameTarget) {
        return false;
      }
      const inputValue = rawValue ?? renameDraft;
      const trimmed = inputValue.trim();
      if (!trimmed) {
        setRenameError('Name is required.');
        return false;
      }
      if (renameTarget.type === 'tab') {
        const currentTab = customTabs.find((tab) => tab.id === renameTarget.id);
        if (!currentTab) {
          cancelRename();
          return false;
        }
        if (trimmed === currentTab.name) {
          cancelRename();
          return true;
        }
        if (!isValidTabName(trimmed)) {
          setRenameError('Use letters, digits, or underscores; start with a letter or underscore.');
          return false;
        }
        const existingNames = new Set<string>([MAIN_TAB_ID, VIEW_TAB_ID]);
        for (const tab of customTabs) {
          if (tab.id !== renameTarget.id) {
            existingNames.add(tab.name.toLowerCase());
          }
        }
        const lower = trimmed.toLowerCase();
        if (existingNames.has(lower)) {
          setRenameError('That name is already in use.');
          return false;
        }
        if (currentTab.folderId === null) {
          for (const folder of customFolders) {
            if (folder.name.toLowerCase() === lower) {
              setRenameError('That name is already in use.');
              return false;
            }
          }
        }
        setCustomTabs((current) =>
          current.map((tab) => (tab.id === renameTarget.id ? { ...tab, name: trimmed } : tab))
        );
        setSelectedExampleId((current) => (current === 'custom' ? current : 'custom'));
        if (activeExpressionTab === renameTarget.id) {
          setPendingFocusEditorId(renameTarget.id);
        }
      } else {
        const currentFolder = customFolders.find((folder) => folder.id === renameTarget.id);
        if (!currentFolder) {
          cancelRename();
          return false;
        }
        if (trimmed === currentFolder.name) {
          cancelRename();
          return true;
        }
        const lower = trimmed.toLowerCase();
        for (const folder of customFolders) {
          if (folder.id !== renameTarget.id && folder.name.toLowerCase() === lower) {
            setRenameError('That name is already in use.');
            return false;
          }
        }
        for (const tab of customTabs) {
          if (tab.folderId === null && tab.name.toLowerCase() === lower) {
            setRenameError('That name is already used by a file.');
            return false;
          }
        }
        setCustomFolders((current) =>
          current.map((folder) => (folder.id === renameTarget.id ? { ...folder, name: trimmed } : folder))
        );
        setSelectedExampleId((current) => (current === 'custom' ? current : 'custom'));
      }
      renameCommittedRef.current = true;
      setRenameTarget(null);
      setRenameDraft('');
      setRenameError(null);
      return true;
    },
    [
      activeExpressionTab,
      customFolders,
      customTabs,
      renameDraft,
      renameTarget,
      setCustomFolders,
      setCustomTabs,
      setPendingFocusEditorId,
      setSelectedExampleId,
      setRenameError,
      setRenameTarget
    ]
  );

  const handleRenameDraftChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setRenameDraft(event.target.value);
    setRenameError(null);
    renameCommittedRef.current = false;
  }, []);

  const handleRenameDraftKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const committed = commitRename(event.currentTarget.value);
        if (committed && event.currentTarget) {
          event.currentTarget.blur();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelRename();
      }
    },
    [cancelRename, commitRename]
  );

  const handleRenameDraftBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (renameCommittedRef.current) {
        renameCommittedRef.current = false;
        return;
      }
      const committed = commitRename(event.currentTarget.value);
      if (!committed) {
        requestAnimationFrame(() => {
          if (renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
          }
        });
      }
    },
    [commitRename]
  );

  const handleRemoveTab = useCallback(
    (tabId: string) => {
      setCustomTabs((current) => current.filter((tab) => tab.id !== tabId));
      setSelectedExampleId((current) => (current === 'custom' ? current : 'custom'));
      if (renameTarget && renameTarget.type === 'tab' && renameTarget.id === tabId) {
        cancelRename();
      }
      setActiveExpressionTab((current) => (current === tabId ? MAIN_TAB_ID : current));
    },
    [cancelRename, renameTarget]
  );

  const handleRemoveFolder = useCallback(
    (folderId: string) => {
      const removedTabIds = new Set<string>();
      for (const tab of customTabs) {
        if (tab.folderId === folderId) {
          removedTabIds.add(tab.id);
        }
      }
      setCustomFolders((current) => current.filter((folder) => folder.id !== folderId));
      setCustomTabs((current) => current.filter((tab) => tab.folderId !== folderId));
      setSelectedExampleId((current) => (current === 'custom' ? current : 'custom'));
      if (renameTarget) {
        if (renameTarget.type === 'folder' && renameTarget.id === folderId) {
          cancelRename();
        } else if (renameTarget.type === 'tab' && removedTabIds.has(renameTarget.id)) {
          cancelRename();
        }
      }
      if (tabDraftFolderId === folderId) {
        setTabNameDraft(null);
        setTabNameDraftError(null);
        setTabDraftFolderId(null);
      }
      setActiveExpressionTab((current) =>
        removedTabIds.has(current) ? MAIN_TAB_ID : current
      );
    },
    [cancelRename, customTabs, renameTarget, tabDraftFolderId]
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
      const existingNames = new Set<string>([MAIN_TAB_ID, VIEW_TAB_ID]);
      for (const tab of customTabs) {
        existingNames.add(tab.name.toLowerCase());
      }
      if (tabDraftFolderId === null) {
        for (const folder of customFolders) {
          existingNames.add(folder.name.toLowerCase());
        }
      }
      if (existingNames.has(lowerName)) {
        setTabNameDraftError('That name is already in use.');
        return false;
      }

      const newTab: CustomTabState = {
        id: createCustomTabId(),
        name: trimmedName,
        expression: '{\n  return 0;\n}',
        folderId: tabDraftFolderId
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
    [customFolders, customTabs, tabDraftFolderId, tabNameDraft]
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
        setTabNameDraft(null);
        setTabNameDraftError(null);
        setTabDraftFolderId(null);
      }
    },
    [commitCustomTabDraft]
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
    const snapshot: PersistedSnapshot = {
      leftWidth,
      selectedExampleId,
      graphicsExpression,
      viewExpression,
      customTabs,
      customFolders,
      activeExpressionTab
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
  const evaluationState = useMemo(() => {
    const baseProvider = prepareProvider();
    const manager = new WorkspaceEvaluationManager(baseProvider, customTabs, customFolders, time);
    const environmentProvider = manager.getEnvironmentProvider();

    const evaluationMap = new Map<string, EvaluationResult>();

    for (const tab of customTabs) {
      const providerForTab = tab.folderId && manager.hasFolder(tab.folderId)
        ? manager.getFolderProvider(tab.folderId)
        : environmentProvider;
      const result = manager.evaluateTab(tab, providerForTab);
      evaluationMap.set(tab.id, result);
    }

    const viewResult = evaluateExpression(environmentProvider, viewExpression);
    if (viewResult.typed) {
      environmentProvider.setNamedValue('view', viewResult.typed);
    } else {
      environmentProvider.setNamedValue('view', null);
    }
    const graphicsResult = evaluateExpression(environmentProvider, graphicsExpression);

    return {
      customEvaluations: evaluationMap,
      viewEvaluation: viewResult,
      graphicsEvaluation: graphicsResult
    };
  }, [customFolders, customTabs, graphicsExpression, time, viewExpression]);

  const customTabEvaluations = evaluationState.customEvaluations;
  const viewEvaluation = evaluationState.viewEvaluation;
  const graphicsEvaluation = evaluationState.graphicsEvaluation;

  const tabsByFolder = useMemo(() => {
    const map = new Map<string, CustomTabState[]>();
    for (const tab of customTabs) {
      if (!tab.folderId) {
        continue;
      }
      const list = map.get(tab.folderId);
      if (list) {
        list.push(tab);
      } else {
        map.set(tab.folderId, [tab]);
      }
    }
    for (const entry of map.values()) {
      entry.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }
    return map;
  }, [customTabs]);

  const rootCustomTabs = useMemo(
    () =>
      customTabs
        .filter((tab) => tab.folderId === null)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [customTabs]
  );

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
    setCustomTabs(createCustomTabsFromDefinitions(example.customTabs));
    setCustomFolders([]);
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

  const renderCustomTabButton = (tab: CustomTabState, nested = false) => {
    const customActive = activeExpressionTab === tab.id;
    const evaluation = customTabEvaluations.get(tab.id);
    const hasError = Boolean(evaluation?.error);
    const isRenaming = renameTarget?.type === 'tab' && renameTarget.id === tab.id;
    const rowClassName = ['expression-tab-row', nested ? 'expression-tab-row-nested' : '']
      .filter(Boolean)
      .join(' ');
    const baseButtonClass = [
      'expression-tab',
      nested ? 'expression-tab-nested' : '',
      customActive ? 'expression-tab-active' : '',
      hasError ? 'expression-tab-error-state' : ''
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <div key={tab.id} className={rowClassName} role="presentation">
        <div className="expression-tab-main">
          {isRenaming ? (
            <div className="expression-rename-row">
              <input
                ref={renameInputRef}
                className="expression-tab-input expression-rename-input"
                value={renameDraft}
                onChange={handleRenameDraftChange}
                onKeyDown={handleRenameDraftKeyDown}
                onBlur={handleRenameDraftBlur}
                aria-label="Rename expression"
              />
              <div className="expression-tab-icons">
                <button
                  type="button"
                  className="expression-icon-button"
                  onClick={() => {
                    const committed = commitRename(renameDraft);
                    if (!committed && renameInputRef.current) {
                      renameInputRef.current.focus();
                      renameInputRef.current.select();
                    }
                  }}
                  aria-label="Save name"
                >
                  <ConfirmIcon />
                </button>
                <button
                  type="button"
                  className="expression-icon-button"
                  onClick={cancelRename}
                  aria-label="Cancel rename"
                >
                  <CancelIcon />
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                role="tab"
                id={getExpressionTabButtonId(tab.id)}
                aria-controls={getExpressionTabPanelId(tab.id)}
                aria-selected={customActive}
                tabIndex={customActive ? 0 : -1}
                className={baseButtonClass}
                onClick={() => handleExpressionTabSelect(tab.id)}
              >
                {tab.name}
              </button>
              <div className="expression-tab-icons">
                <button
                  type="button"
                  className="expression-icon-button"
                  onClick={() => handleRenameTabStart(tab)}
                  aria-label={`Rename ${tab.name}`}
                >
                  <RenameIcon />
                </button>
                <button
                  type="button"
                  className="expression-icon-button"
                  onClick={() => handleRemoveTab(tab.id)}
                  aria-label={`Remove ${tab.name}`}
                >
                  <DeleteIcon />
                </button>
              </div>
            </>
          )}
        </div>
        {isRenaming && renameError ? (
          <p className="expression-tab-error expression-rename-error" role="alert">
            {renameError}
          </p>
        ) : null}
      </div>
    );
  };

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

            <div className="expression-tabs">
              <div className="expression-tabs-header">
                <div
                  className="expression-tabs-list"
                  role="tablist"
                  aria-label="Expression editors"
                >
                  <button
                    type="button"
                    role="tab"
                    id={getExpressionTabButtonId(MAIN_TAB_ID)}
                    aria-controls={getExpressionTabPanelId(MAIN_TAB_ID)}
                    aria-selected={isMainTabActive}
                    tabIndex={isMainTabActive ? 0 : -1}
                    className={`expression-tab${isMainTabActive ? ' expression-tab-active' : ''}`}
                    onClick={() => handleExpressionTabSelect(MAIN_TAB_ID)}
                  >
                    Main
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id={getExpressionTabButtonId(VIEW_TAB_ID)}
                    aria-controls={getExpressionTabPanelId(VIEW_TAB_ID)}
                    aria-selected={isViewTabActive}
                    tabIndex={isViewTabActive ? 0 : -1}
                    className={`expression-tab${isViewTabActive ? ' expression-tab-active' : ''}`}
                    onClick={() => handleExpressionTabSelect(VIEW_TAB_ID)}
                  >
                    View
                  </button>
                  {rootCustomTabs.map((tab) => renderCustomTabButton(tab))}
                  <div className="expression-add-controls" role="presentation">
                    <div className="expression-add-expression">
                      {tabNameDraft !== null && tabDraftFolderId === null ? (
                        <input
                          ref={newTabInputRef}
                          className="expression-tab-input"
                          value={tabNameDraft}
                          onChange={handleTabNameDraftChange}
                          onKeyDown={handleTabNameDraftKeyDown}
                          onBlur={handleTabNameDraftBlur}
                          aria-label="New tab name"
                        />
                      ) : (
                        <button
                          type="button"
                          className="expression-tab expression-tab-add"
                          onClick={() => handleAddTabClick(null)}
                          aria-label="Add expression tab"
                        >
                          +
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className="expression-tab expression-tab-add expression-folder-button"
                      onClick={handleAddFolderClick}
                      aria-label="Add folder"
                    >
                      Add folder
                    </button>
                  </div>
                  {customFolders.map((folder) => {
                    const folderTabs = tabsByFolder.get(folder.id) ?? [];
                    const folderRenaming = renameTarget?.type === 'folder' && renameTarget.id === folder.id;
                    return (
                      <div key={folder.id} className="expression-folder" role="presentation">
                        {folderRenaming ? (
                          <div className="expression-folder-header expression-folder-header-edit">
                            <div className="expression-rename-row">
                              <input
                                ref={renameInputRef}
                                className="expression-tab-input expression-rename-input"
                                value={renameDraft}
                                onChange={handleRenameDraftChange}
                                onKeyDown={handleRenameDraftKeyDown}
                                onBlur={handleRenameDraftBlur}
                                aria-label="Rename folder"
                              />
                              <div className="expression-tab-icons">
                                <button
                                  type="button"
                                  className="expression-icon-button"
                                  onClick={() => {
                                    const committed = commitRename(renameDraft);
                                    if (!committed && renameInputRef.current) {
                                      renameInputRef.current.focus();
                                      renameInputRef.current.select();
                                    }
                                  }}
                                  aria-label="Save folder name"
                                >
                                  <ConfirmIcon />
                                </button>
                                <button
                                  type="button"
                                  className="expression-icon-button"
                                  onClick={cancelRename}
                                  aria-label="Cancel rename"
                                >
                                  <CancelIcon />
                                </button>
                              </div>
                            </div>
                            {renameError ? (
                              <p className="expression-tab-error expression-rename-error" role="alert">
                                {renameError}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="expression-folder-header">
                            <span className="expression-folder-name">{folder.name}</span>
                            <div className="expression-folder-actions">
                              <button
                                type="button"
                                className="expression-icon-button"
                                onClick={() => handleAddTabClick(folder.id)}
                                aria-label={`Add expression inside ${folder.name}`}
                              >
                                +
                              </button>
                              <button
                                type="button"
                                className="expression-icon-button"
                                onClick={() => handleRenameFolderStart(folder)}
                                aria-label={`Rename folder ${folder.name}`}
                              >
                                <RenameIcon />
                              </button>
                              <button
                                type="button"
                                className="expression-icon-button"
                                onClick={() => handleRemoveFolder(folder.id)}
                                aria-label={`Remove folder ${folder.name}`}
                              >
                                <DeleteIcon />
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="expression-folder-tabs">
                          {folderTabs.map((tab) => renderCustomTabButton(tab, true))}
                          {tabNameDraft !== null && tabDraftFolderId === folder.id ? (
                            <input
                              ref={newTabInputRef}
                              className="expression-tab-input expression-folder-input"
                              value={tabNameDraft}
                              onChange={handleTabNameDraftChange}
                              onKeyDown={handleTabNameDraftKeyDown}
                              onBlur={handleTabNameDraftBlur}
                              aria-label={`New tab name for ${folder.name}`}
                            />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {tabNameDraftError ? (
                  <p className="expression-tab-error" role="alert">
                    {tabNameDraftError}
                  </p>
                ) : null}
              </div>
              <div className="expression-tab-panels">
                <div
                  role="tabpanel"
                  id={getExpressionTabPanelId(MAIN_TAB_ID)}
                  aria-labelledby={getExpressionTabButtonId(MAIN_TAB_ID)}
                  hidden={activeExpressionTab !== MAIN_TAB_ID}
                  className="expression-tab-panel"
                >
                  <label className="input-label" htmlFor="main-expression-editor">
                    Main expression
                  </label>
                  <div
                    className="editor-container editor-container-fill"
                    data-editor-id={MAIN_TAB_ID}
                    id="main-expression-editor"
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
                  <label className="input-label" htmlFor="view-expression-editor">
                    View expression
                  </label>
                  <div
                    className="editor-container editor-container-fill"
                    data-editor-id={VIEW_TAB_ID}
                    id="view-expression-editor"
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
                      <label className="input-label" htmlFor={`custom-expression-editor-${tab.id}`}>
                        {tab.name} expression
                      </label>
                      <div
                        className="editor-container editor-container-fill"
                        data-editor-id={tab.id}
                        id={`custom-expression-editor-${tab.id}`}
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
