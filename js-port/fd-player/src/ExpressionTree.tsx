import {
  ChangeEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import type { CustomFolderState, CustomTabState } from './workspace';
import type { EvaluationResult } from './graphics';
import type { RenameTarget } from './App';
import { isValidTabName } from './workspace';

type ExpressionTreeProps = {
  mainTabId: string;
  viewTabId: string;
  isMainTabActive: boolean;
  isViewTabActive: boolean;
  activeExpressionTab: string;
  entriesByParent: Map<string | null, ExpressionEntry[]>;
  tabEvaluations: Map<string, EvaluationResult>;
  tabNameDraft: string | null;
  tabDraftFolderId: string | null;
  tabNameDraftError: string | null;
  newTabInputRef: RefObject<HTMLInputElement>;
  getButtonId: (tabId: string) => string;
  getPanelId: (tabId: string) => string;
  collapsedFolders: Set<string>;
  onSelectTab: (tabId: string) => void;
  onAddTab: (folderId: string | null) => void;
  onAddFolder: (parentId: string | null) => CustomFolderState;
  onTabDraftChange: ChangeEventHandler<HTMLInputElement>;
  onTabDraftKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onTabDraftBlur: FocusEventHandler<HTMLInputElement>;
  onCancelTabDraft: () => void;
  onRenameTab: (tabId: string, name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onRemoveTab: (tabId: string) => void;
  onRemoveFolder: (folderId: string) => void;
  onToggleFolderCollapse: (folderId: string) => void;
  onEnsureFolderExpanded: (folderId: string | null) => void;
  onExpandAllFolders: () => void;
  onCollapseAllFolders: () => void;
};

type ExpressionEntry =
  | { kind: 'tab'; createdAt: number; tab: CustomTabState }
  | { kind: 'folder'; createdAt: number; folder: CustomFolderState };

const ConfirmIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M16.707 5.293a1 1 0 0 0-1.414 0L8.5 12.086 5.707 9.293a1 1 0 1 0-1.414 1.414l3.5 3.5a1 1 0 0 0 1.414 0l7-7a1 1 0 0 0 0-1.414Z" fill="currentColor" />
  </svg>
);

const CancelIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path
      d="M5.293 5.293a1 1 0 0 1 1.414 0L10 8.586l3.293-3.293a1 1 0 0 1 1.414 1.414L11.414 10l3.293 3.293a1 1 0 0 1-1.414 1.414L10 11.414l-3.293 3.293a1 1 0 0 1-1.414-1.414L8.586 10 5.293 6.707a1 1 0 0 1 0-1.414Z"
      fill="currentColor"
    />
  </svg>
);

const MenuIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path
      d="M6 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-12 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
      fill="currentColor"
    />
  </svg>
);

const AddIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M9 3a1 1 0 0 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H3a1 1 0 0 1 0-2h6V3Z" fill="currentColor" />
  </svg>
);

const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M3 6a2 2 0 0 1 2-2h4.2a2 2 0 0 1 1.6.8L12.2 6H19a2 2 0 0 1 2 2v2.5H3V6Zm0 5.5h18V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6.5Zm9 1.5a.75.75 0 0 0-1.5 0V16H7a.75.75 0 0 0 0 1.5h3.5V21a.75.75 0 0 0 1.5 0v-3.5H15A.75.75 0 1 0 15 16h-3V13Z"
      fill="currentColor"
    />
  </svg>
);

const ChevronIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path
      d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.14l3.71-3.91a.75.75 0 0 1 1.08 1.04l-4.24 4.46a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
      fill="currentColor"
      transform={collapsed ? 'rotate(-90 10 10)' : undefined}
    />
  </svg>
);

const MainIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M5 4h14a1 1 0 0 1 .92 1.38l-5 12a1 1 0 0 1-.92.62H5a1 1 0 0 1-.92-1.38l5-12A1 1 0 0 1 10 4Z"
      fill="currentColor"
    />
  </svg>
);

const ViewIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 6c5 0 9 4 10 6-1 2-5 6-10 6S3 14 2 12c1-2 5-6 10-6Zm0 2c-2.2 0-4 1.8-4 4s1.8 4 4 4a4 4 0 0 0 0-8Zm0 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
      fill="currentColor"
    />
  </svg>
);

const ReturnIcon = () => (
  <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path
      d="M10 3a1 1 0 0 1 .9.56l3 6a1 1 0 0 1-.9 1.44H7a1 1 0 0 1-.9-1.44l3-6A1 1 0 0 1 10 3Zm0 8a1 1 0 0 1 .95.68l2 6a1 1 0 0 1-1.9.64L10 13.6l-1.05 4.72a1 1 0 0 1-1.9-.64l2-6A1 1 0 0 1 10 11Z"
      fill="currentColor"
    />
  </svg>
);

export const ExpressionTree = ({
  mainTabId,
  viewTabId,
  isMainTabActive,
  isViewTabActive,
  activeExpressionTab,
  entriesByParent,
  tabEvaluations,
  tabNameDraft,
  tabDraftFolderId,
  tabNameDraftError,
  newTabInputRef,
  getButtonId,
  getPanelId,
  collapsedFolders,
  onSelectTab,
  onAddTab,
  onAddFolder,
  onTabDraftChange,
  onTabDraftKeyDown,
  onTabDraftBlur,
  onCancelTabDraft,
  onRenameTab,
  onRenameFolder,
  onRemoveTab,
  onRemoveFolder,
  onToggleFolderCollapse,
  onEnsureFolderExpanded,
  onExpandAllFolders,
  onCollapseAllFolders
}: ExpressionTreeProps) => {
  const isRootDrafting = tabNameDraft !== null && tabDraftFolderId === null;
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef(new Map<string, HTMLDivElement | null>());
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuPortalRef = useRef<HTMLDivElement | null>(null);
  const rootEntries = entriesByParent.get(null) ?? [];
  const orderEntries = useCallback((entries: ExpressionEntry[]) => {
    if (!entries || entries.length === 0) {
      return [];
    }
    const returnEntries: ExpressionEntry[] = [];
    const others: ExpressionEntry[] = [];
    for (const entry of entries) {
      if (
        entry.kind === 'tab' &&
        entry.tab.name.trim().toLowerCase() === 'return'
      ) {
        returnEntries.push(entry);
      } else {
        others.push(entry);
      }
    }
    return [...returnEntries, ...others];
  }, []);
  const orderedRootEntries = orderEntries(rootEntries);

  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameCommittedRef = useRef(false);

  const { tabById, folderById } = useMemo(() => {
    const tabMap = new Map<string, CustomTabState>();
    const folderMap = new Map<string, CustomFolderState>();
    for (const group of entriesByParent.values()) {
      for (const entry of group) {
        if (entry.kind === 'tab') {
          tabMap.set(entry.tab.id, entry.tab);
        } else {
          folderMap.set(entry.folder.id, entry.folder);
        }
      }
    }
    return { tabById: tabMap, folderById: folderMap };
  }, [entriesByParent]);

  const getContextNameSet = useCallback(
    (
      parentId: string | null,
      options?: { excludeTabId?: string; excludeFolderId?: string }
    ) => {
      const names = new Set<string>();
      if (parentId === null) {
        names.add(mainTabId.toLowerCase());
        names.add(viewTabId.toLowerCase());
      }
      const entries = entriesByParent.get(parentId ?? null) ?? [];
      for (const entry of entries) {
        if (entry.kind === 'tab') {
          if (entry.tab.id !== options?.excludeTabId) {
            names.add(entry.tab.name.toLowerCase());
          }
        } else if (entry.folder.id !== options?.excludeFolderId) {
          names.add(entry.folder.name.toLowerCase());
        }
      }
      return names;
    },
    [entriesByParent, mainTabId, viewTabId]
  );

  const cancelRename = useCallback(() => {
    setRenameTarget(null);
    setRenameDraft('');
    setRenameError(null);
    renameCommittedRef.current = false;
  }, []);

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
    if (!renameTarget) {
      return;
    }
    const exists =
      renameTarget.type === 'tab'
        ? tabById.has(renameTarget.id)
        : folderById.has(renameTarget.id);
    if (!exists) {
      cancelRename();
    }
  }, [renameTarget, tabById, folderById, cancelRename]);

  const handleRenameTabStart = useCallback(
    (tab: CustomTabState) => {
      onCancelTabDraft();
      setRenameTarget({ type: 'tab', id: tab.id });
      setRenameDraft(tab.name);
      setRenameError(null);
      renameCommittedRef.current = false;
    },
    [onCancelTabDraft]
  );

  const handleRenameFolderStart = useCallback(
    (folder: CustomFolderState) => {
      onCancelTabDraft();
      setRenameTarget({ type: 'folder', id: folder.id });
      setRenameDraft(folder.name);
      setRenameError(null);
      renameCommittedRef.current = false;
    },
    [onCancelTabDraft]
  );

  const commitRename = useCallback(
    (rawValue?: string) => {
      if (!renameTarget) {
        return false;
      }
      const nextValue = rawValue ?? renameDraft;
      const trimmed = nextValue.trim();
      if (!trimmed) {
        setRenameError('Name is required.');
        return false;
      }
      if (renameTarget.type === 'tab') {
        const tab = tabById.get(renameTarget.id);
        if (!tab) {
          cancelRename();
          return false;
        }
        if (trimmed === tab.name) {
          cancelRename();
          return true;
        }
        if (!isValidTabName(trimmed)) {
          setRenameError('Use letters, digits, or underscores; start with a letter or underscore.');
          return false;
        }
        const existing = getContextNameSet(tab.folderId ?? null, { excludeTabId: tab.id });
        if (existing.has(trimmed.toLowerCase())) {
          setRenameError('That name is already in use.');
          return false;
        }
        onRenameTab(tab.id, trimmed);
      } else {
        const folder = folderById.get(renameTarget.id);
        if (!folder) {
          cancelRename();
          return false;
        }
        if (trimmed === folder.name) {
          cancelRename();
          return true;
        }
        const existing = getContextNameSet(folder.parentId ?? null, { excludeFolderId: folder.id });
        if (existing.has(trimmed.toLowerCase())) {
          setRenameError('That name is already in use.');
          return false;
        }
        onRenameFolder(folder.id, trimmed);
      }
      renameCommittedRef.current = true;
      cancelRename();
      return true;
    },
    [
      cancelRename,
      folderById,
      getContextNameSet,
      onRenameFolder,
      onRenameTab,
      renameDraft,
      renameTarget,
      tabById
    ]
  );

  const handleRenameDraftChange = useCallback<ChangeEventHandler<HTMLInputElement>>((event) => {
    setRenameDraft(event.target.value);
    setRenameError(null);
    renameCommittedRef.current = false;
  }, []);

  const handleRenameDraftKeyDown = useCallback<KeyboardEventHandler<HTMLInputElement>>(
    (event) => {
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

  const handleRenameDraftBlur = useCallback<FocusEventHandler<HTMLInputElement>>(
    (event) => {
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

  const handleAddFolderRequest = useCallback(
    (parentId: string | null) => {
      const folder = onAddFolder(parentId);
      handleRenameFolderStart(folder);
      return folder;
    },
    [handleRenameFolderStart, onAddFolder]
  );

  const registerMenuRef = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) {
      menuRefs.current.set(id, node);
    } else {
      menuRefs.current.delete(id);
    }
  }, []);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      const wrapper = menuRefs.current.get(openMenuId);
      const portal = menuPortalRef.current;
      if ((wrapper && wrapper.contains(target)) || (portal && portal.contains(target))) {
        return;
      }
      setOpenMenuId(null);
      setMenuPosition(null);
      menuPortalRef.current = null;
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

  const closeMenu = useCallback(() => {
    setOpenMenuId(null);
    setMenuPosition(null);
    menuPortalRef.current = null;
  }, []);

  const toggleMenu = useCallback(
    (menuId: string) => {
      setOpenMenuId((current) => {
        if (current === menuId) {
          setMenuPosition(null);
          menuPortalRef.current = null;
          return null;
        }
        return menuId;
      });
    },
    []
  );

  const updateMenuPosition = useCallback(() => {
    if (!openMenuId || typeof window === 'undefined') {
      setMenuPosition(null);
      return;
    }
    const anchor = menuRefs.current.get(openMenuId);
    if (!anchor) {
      setMenuPosition(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 190;
    const maxLeft = window.innerWidth - menuWidth - 8;
    const left = Math.min(maxLeft, Math.max(8, rect.right - menuWidth));
    const maxTop = window.innerHeight - 210;
    const top = Math.min(maxTop, rect.bottom + 8);
    setMenuPosition({ top, left });
  }, [openMenuId]);

  useLayoutEffect(() => {
    if (!openMenuId) {
      return;
    }
    const handle = () => updateMenuPosition();
    handle();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [openMenuId, updateMenuPosition]);

  const renderMenuButton = (
    menuId: string,
    actions: Array<{ key: string; label: string; handler: () => void }>,
    extraClassName?: string
  ) => (
    <div
      className={[
        'expression-menu-wrapper',
        extraClassName ?? '',
        openMenuId === menuId ? 'expression-menu-wrapper-open' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      ref={(node) => registerMenuRef(menuId, node)}
    >
      <button
        type="button"
        className="expression-menu-button"
        aria-haspopup="menu"
        aria-expanded={openMenuId === menuId}
        onClick={() => toggleMenu(menuId)}
      >
        <MenuIcon />
      </button>
      {openMenuId === menuId && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="expression-menu expression-menu-portal"
              role="menu"
              style={{ top: menuPosition.top, left: menuPosition.left }}
              ref={(node) => {
                menuPortalRef.current = node;
              }}
            >
              {actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className="expression-menu-item"
                  role="menuitem"
                  onClick={() => {
                    action.handler();
                    closeMenu();
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );

  const renderRootHeader = () => {
    const actions = [
      { key: 'add-file', label: 'Add file', handler: () => onAddTab(null), icon: <AddIcon /> },
      {
        key: 'add-folder',
        label: 'Add folder',
        handler: () => handleAddFolderRequest(null),
        icon: <FolderIcon />
      },
      {
        key: 'expand',
        label: 'Expand all',
        handler: onExpandAllFolders,
        icon: <ChevronIcon collapsed={false} />
      },
      {
        key: 'collapse',
        label: 'Collapse all',
        handler: onCollapseAllFolders,
        icon: <ChevronIcon collapsed />
      }
    ];

    return (
      <div className="expression-tree-toolbar" role="toolbar" aria-label="Tree actions">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className="expression-toolbar-button"
            onClick={action.handler}
            title={action.label}
            aria-label={action.label}
          >
            {action.icon}
          </button>
        ))}
      </div>
    );
  };

  const renderRootDraftInput = () => {
    if (!isRootDrafting) {
      return null;
    }
    return (
      <input
        ref={newTabInputRef}
        className="expression-tab-input expression-root-input"
        value={tabNameDraft ?? ''}
        onChange={onTabDraftChange}
        onKeyDown={onTabDraftKeyDown}
        onBlur={onTabDraftBlur}
        aria-label="New tab name"
      />
    );
  };

  const renderCustomTabButton = (tab: CustomTabState, nested = false) => {
    const customActive = activeExpressionTab === tab.id;
    const evaluation = tabEvaluations.get(tab.id);
    const hasError = Boolean(evaluation?.error);
    const isRenaming = renameTarget?.type === 'tab' && renameTarget.id === tab.id;
    const rowClassName = ['expression-tab-row', nested ? 'expression-tab-row-nested' : '']
      .filter(Boolean)
      .join(' ');
    const baseButtonClass = [
      'expression-tab',
      nested ? 'expression-tab-nested' : '',
      'expression-tab-file',
      customActive ? 'expression-tab-active' : '',
      hasError ? 'expression-tab-error-state' : ''
    ]
      .filter(Boolean)
      .join(' ');
    const normalizedName = tab.name.trim().toLowerCase();
    const isReturnTab = normalizedName === 'return';
    const icon = isReturnTab ? <ReturnIcon /> : null;
    const buttonClassName = [baseButtonClass, isReturnTab ? 'expression-tab-return' : '']
      .filter(Boolean)
      .join(' ');

    const tabMenuId = `tab-menu-${tab.id}`;
    const tabActions = [
      { key: 'rename', label: 'Rename', handler: () => handleRenameTabStart(tab) },
      {
        key: 'delete',
        label: 'Delete',
        handler: () => {
          if (renameTarget?.type === 'tab' && renameTarget.id === tab.id) {
            cancelRename();
          }
          onRemoveTab(tab.id);
        }
      }
    ];

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
                id={getButtonId(tab.id)}
                aria-controls={getPanelId(tab.id)}
                aria-selected={customActive}
                tabIndex={customActive ? 0 : -1}
                className={buttonClassName}
                onClick={() => onSelectTab(tab.id)}
              >
                <span className="expression-tab-label">
                  {icon ? <span className="expression-tab-icon">{icon}</span> : null}
                  {tab.name}
                </span>
              </button>
              {renderMenuButton(tabMenuId, tabActions, 'expression-tab-menu-wrapper')}
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

  const renderFolder = (folder: CustomFolderState): JSX.Element => {
    const childEntries = orderEntries(entriesByParent.get(folder.id) ?? []);
    const folderRenaming = renameTarget?.type === 'folder' && renameTarget.id === folder.id;
    const isDraftingInFolder = tabNameDraft !== null && tabDraftFolderId === folder.id;
    const isCollapsed = !folderRenaming && collapsedFolders.has(folder.id);

    const folderMenuId = `folder-menu-${folder.id}`;
    const folderActions = [
      {
        key: 'add-file',
        label: 'Add file',
        handler: () => {
          onEnsureFolderExpanded(folder.id);
          onAddTab(folder.id);
        }
      },
      {
        key: 'add-folder',
        label: 'Add folder',
        handler: () => {
          onEnsureFolderExpanded(folder.id);
          handleAddFolderRequest(folder.id);
        }
      },
      { key: 'rename', label: 'Rename', handler: () => handleRenameFolderStart(folder) },
      {
        key: 'delete',
        label: 'Delete',
        handler: () => {
          if (renameTarget?.type === 'folder' && renameTarget.id === folder.id) {
            cancelRename();
          }
          onRemoveFolder(folder.id);
        }
      }
    ];

    return (
      <div
        key={folder.id}
        className={['expression-folder', isCollapsed ? 'expression-folder-collapsed' : '']
          .filter(Boolean)
          .join(' ')}
        role="presentation"
      >
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
            {folderRenaming && renameError ? (
              <p className="expression-tab-error expression-rename-error" role="alert">
                {renameError}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="expression-folder-header">
            <button
              type="button"
              className="expression-folder-toggle"
              aria-label={isCollapsed ? `Expand ${folder.name}` : `Collapse ${folder.name}`}
              onClick={(event) => {
                onToggleFolderCollapse(folder.id);
                event.currentTarget.blur();
              }}
            >
              <ChevronIcon collapsed={isCollapsed} />
            </button>
            <span className="expression-folder-name">{folder.name}</span>
            {renderMenuButton(folderMenuId, folderActions, 'expression-folder-menu-wrapper')}
          </div>
        )}
        {!isCollapsed ? (
          <div className="expression-folder-tabs">
            {childEntries.map((entry) =>
              entry.kind === 'tab'
                ? renderCustomTabButton(entry.tab, true)
                : renderFolder(entry.folder)
            )}
            {isDraftingInFolder ? (
              <input
                ref={newTabInputRef}
                className="expression-tab-input expression-folder-input"
                value={tabNameDraft ?? ''}
                onChange={onTabDraftChange}
                onKeyDown={onTabDraftKeyDown}
                onBlur={onTabDraftBlur}
                aria-label={`New tab name for ${folder.name}`}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="expression-tabs-header">
      {renderRootHeader()}
      <div className="expression-tabs-shell">
        <div className="expression-tabs-scroll" role="tablist" aria-label="Expression editors">
          <button
            type="button"
            role="tab"
            id={getButtonId(mainTabId)}
            aria-controls={getPanelId(mainTabId)}
            aria-selected={isMainTabActive}
            tabIndex={isMainTabActive ? 0 : -1}
            className={`expression-tab expression-tab-main${
              isMainTabActive ? ' expression-tab-active' : ''
            }`}
            onClick={() => onSelectTab(mainTabId)}
          >
            <span className="expression-tab-label">
              <span className="expression-tab-icon">
                <MainIcon />
              </span>
              Main
            </span>
          </button>
          <button
            type="button"
            role="tab"
            id={getButtonId(viewTabId)}
            aria-controls={getPanelId(viewTabId)}
            aria-selected={isViewTabActive}
            tabIndex={isViewTabActive ? 0 : -1}
            className={`expression-tab expression-tab-view${
              isViewTabActive ? ' expression-tab-active' : ''
            }`}
            onClick={() => onSelectTab(viewTabId)}
          >
            <span className="expression-tab-label">
              <span className="expression-tab-icon">
                <ViewIcon />
              </span>
              View
            </span>
          </button>
        {orderedRootEntries.map((entry) =>
          entry.kind === 'tab' ? renderCustomTabButton(entry.tab) : renderFolder(entry.folder)
        )}
        {renderRootDraftInput()}
      </div>
      </div>
      {tabNameDraftError ? (
        <p className="expression-tab-error" role="alert">
          {tabNameDraftError}
        </p>
      ) : null}
    </div>
  );
};
