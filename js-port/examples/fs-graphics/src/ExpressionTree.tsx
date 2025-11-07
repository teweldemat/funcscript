import {
  ChangeEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import type { CustomFolderState, CustomTabState, RenameTarget } from './App';
import type { EvaluationResult } from './graphics';

type ExpressionTreeProps = {
  mainTabId: string;
  viewTabId: string;
  isMainTabActive: boolean;
  isViewTabActive: boolean;
  activeExpressionTab: string;
  entriesByParent: Map<string | null, ExpressionEntry[]>;
  activeExpressionTitle: string;
  tabEvaluations: Map<string, EvaluationResult>;
  tabNameDraft: string | null;
  tabDraftFolderId: string | null;
  tabNameDraftError: string | null;
  renameTarget: RenameTarget | null;
  renameDraft: string;
  renameError: string | null;
  newTabInputRef: RefObject<HTMLInputElement>;
  renameInputRef: RefObject<HTMLInputElement>;
  getButtonId: (tabId: string) => string;
  getPanelId: (tabId: string) => string;
  onSelectTab: (tabId: string) => void;
  onAddTab: (folderId: string | null) => void;
  onAddFolder: (parentId: string | null) => void;
  onTabDraftChange: ChangeEventHandler<HTMLInputElement>;
  onTabDraftKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onTabDraftBlur: FocusEventHandler<HTMLInputElement>;
  onRenameDraftChange: ChangeEventHandler<HTMLInputElement>;
  onRenameDraftKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onRenameDraftBlur: FocusEventHandler<HTMLInputElement>;
  onRenameTabStart: (tab: CustomTabState) => void;
  onRenameFolderStart: (folder: CustomFolderState) => void;
  onCommitRename: (value?: string) => boolean;
  onCancelRename: () => void;
  onRemoveTab: (tabId: string) => void;
  onRemoveFolder: (folderId: string) => void;
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

const ChevronIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path
      d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.14l3.71-3.91a.75.75 0 0 1 1.08 1.04l-4.24 4.46a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
      fill="currentColor"
      transform={collapsed ? 'rotate(-90 10 10)' : undefined}
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
  activeExpressionTitle,
  tabEvaluations,
  tabNameDraft,
  tabDraftFolderId,
  tabNameDraftError,
  renameTarget,
  renameDraft,
  renameError,
  newTabInputRef,
  renameInputRef,
  getButtonId,
  getPanelId,
  onSelectTab,
  onAddTab,
  onAddFolder,
  onTabDraftChange,
  onTabDraftKeyDown,
  onTabDraftBlur,
  onRenameDraftChange,
  onRenameDraftKeyDown,
  onRenameDraftBlur,
  onRenameTabStart,
  onRenameFolderStart,
  onCommitRename,
  onCancelRename,
  onRemoveTab,
  onRemoveFolder
}: ExpressionTreeProps) => {
  const isRootDrafting = tabNameDraft !== null && tabDraftFolderId === null;
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef(new Map<string, HTMLDivElement | null>());
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuPortalRef = useRef<HTMLDivElement | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());
  const rootEntries = entriesByParent.get(null) ?? [];

  const registerMenuRef = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) {
      menuRefs.current.set(id, node);
    } else {
      menuRefs.current.delete(id);
    }
  }, []);

  const toggleFolderCollapse = useCallback((folderId: string) => {
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

  const ensureFolderExpanded = useCallback((folderId: string | null) => {
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
    const rootActions = [
      { key: 'add-file', label: 'Add file', handler: () => onAddTab(null) },
      { key: 'add-folder', label: 'Add folder', handler: () => onAddFolder(null) }
    ];
    return (
      <div className="expression-tree-header">
        <div className="expression-tree-header-text">
          <span className="expression-tree-header-title">{activeExpressionTitle}</span>
        </div>
        {renderMenuButton(
          'root-menu',
          rootActions,
          'expression-root-menu-wrapper expression-menu-wrapper-static'
        )}
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
      customActive ? 'expression-tab-active' : '',
      hasError ? 'expression-tab-error-state' : ''
    ]
      .filter(Boolean)
      .join(' ');

    const tabMenuId = `tab-menu-${tab.id}`;
    const tabActions = [
      { key: 'rename', label: 'Rename', handler: () => onRenameTabStart(tab) },
      { key: 'delete', label: 'Delete', handler: () => onRemoveTab(tab.id) }
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
                onChange={onRenameDraftChange}
                onKeyDown={onRenameDraftKeyDown}
                onBlur={onRenameDraftBlur}
                aria-label="Rename expression"
              />
              <div className="expression-tab-icons">
                <button
                  type="button"
                  className="expression-icon-button"
                  onClick={() => {
                    const committed = onCommitRename(renameDraft);
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
                  onClick={onCancelRename}
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
                className={baseButtonClass}
                onClick={() => onSelectTab(tab.id)}
              >
                {tab.name}
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
    const childEntries = entriesByParent.get(folder.id) ?? [];
    const folderRenaming = renameTarget?.type === 'folder' && renameTarget.id === folder.id;
    const isDraftingInFolder = tabNameDraft !== null && tabDraftFolderId === folder.id;
    const isCollapsed = !folderRenaming && collapsedFolders.has(folder.id);

    const folderMenuId = `folder-menu-${folder.id}`;
    const folderActions = [
      {
        key: 'add-file',
        label: 'Add file',
        handler: () => {
          ensureFolderExpanded(folder.id);
          onAddTab(folder.id);
        }
      },
      {
        key: 'add-folder',
        label: 'Add folder',
        handler: () => {
          ensureFolderExpanded(folder.id);
          onAddFolder(folder.id);
        }
      },
      { key: 'rename', label: 'Rename', handler: () => onRenameFolderStart(folder) },
      { key: 'delete', label: 'Delete', handler: () => onRemoveFolder(folder.id) }
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
                onChange={onRenameDraftChange}
                onKeyDown={onRenameDraftKeyDown}
                onBlur={onRenameDraftBlur}
                aria-label="Rename folder"
              />
              <div className="expression-tab-icons">
                <button
                  type="button"
                  className="expression-icon-button"
                  onClick={() => {
                    const committed = onCommitRename(renameDraft);
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
                  onClick={onCancelRename}
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
              onClick={() => toggleFolderCollapse(folder.id)}
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
            className={`expression-tab${isMainTabActive ? ' expression-tab-active' : ''}`}
            onClick={() => onSelectTab(mainTabId)}
          >
            Main
          </button>
          <button
            type="button"
            role="tab"
            id={getButtonId(viewTabId)}
          aria-controls={getPanelId(viewTabId)}
          aria-selected={isViewTabActive}
          tabIndex={isViewTabActive ? 0 : -1}
          className={`expression-tab${isViewTabActive ? ' expression-tab-active' : ''}`}
          onClick={() => onSelectTab(viewTabId)}
        >
          View
        </button>
        {rootEntries.map((entry) =>
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
