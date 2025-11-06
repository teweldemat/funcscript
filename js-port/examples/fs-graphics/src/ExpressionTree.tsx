import {
  ChangeEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
  RefObject
} from 'react';
import type { CustomFolderState, CustomTabState, RenameTarget } from './App';
import type { EvaluationResult } from './graphics';

type ExpressionTreeProps = {
  mainTabId: string;
  viewTabId: string;
  isMainTabActive: boolean;
  isViewTabActive: boolean;
  activeExpressionTab: string;
  rootCustomTabs: CustomTabState[];
  customFolders: CustomFolderState[];
  tabsByFolder: Map<string, CustomTabState[]>;
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
  onAddFolder: () => void;
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

const RenameIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path
      d="M4 13.5V16h2.5L15.08 7.42 12.58 4.92 4 13.5Zm11.71-7.79a1 1 0 0 0 0-1.42l-2-2a1 1 0 0 0-1.42 0l-1.29 1.3 3.5 3.5 1.21-1.38Z"
      fill="currentColor"
    />
  </svg>
);

const DeleteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path
      d="M7 2a1 1 0 0 0-1 1v1H3.5a.5.5 0 0 0 0 1H4v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5h.5a.5.5 0 0 0 0-1H14V3a1 1 0 0 0-1-1H7Zm1 2h4V3H8v1Zm-1 2h8v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6Zm2 2a.5.5 0 0 0-.5.5v6a.5.5 0 1 0 1 0v-6A.5.5 0 0 0 9 8Zm3 0a.5.5 0 0 0-.5.5v6a.5.5 0 1 0 1 0v-6A.5.5 0 0 0 12 8Z"
      fill="currentColor"
    />
  </svg>
);

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

export const ExpressionTree = ({
  mainTabId,
  viewTabId,
  isMainTabActive,
  isViewTabActive,
  activeExpressionTab,
  rootCustomTabs,
  customFolders,
  tabsByFolder,
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
              <div className="expression-tab-icons">
                <button
                  type="button"
                  className="expression-icon-button"
                  onClick={() => onRenameTabStart(tab)}
                  aria-label={`Rename ${tab.name}`}
                >
                  <RenameIcon />
                </button>
                <button
                  type="button"
                  className="expression-icon-button"
                  onClick={() => onRemoveTab(tab.id)}
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

  return (
    <div className="expression-tabs-header">
      <div className="expression-tabs-list" role="tablist" aria-label="Expression editors">
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
        {rootCustomTabs.map((tab) => renderCustomTabButton(tab))}
        <div className="expression-add-controls" role="presentation">
          <div className="expression-add-expression">
            {tabNameDraft !== null && tabDraftFolderId === null ? (
              <input
                ref={newTabInputRef}
                className="expression-tab-input"
                value={tabNameDraft}
                onChange={onTabDraftChange}
                onKeyDown={onTabDraftKeyDown}
                onBlur={onTabDraftBlur}
                aria-label="New tab name"
              />
            ) : (
              <button
                type="button"
                className="expression-tab expression-tab-add"
                onClick={() => onAddTab(null)}
                aria-label="Add expression tab"
              >
                +
              </button>
            )}
          </div>
          <button
            type="button"
            className="expression-tab expression-tab-add expression-folder-button"
            onClick={onAddFolder}
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
                  <span className="expression-folder-name">{folder.name}</span>
                  <div className="expression-folder-actions">
                    <button
                      type="button"
                      className="expression-icon-button"
                      onClick={() => onAddTab(folder.id)}
                      aria-label={`Add expression inside ${folder.name}`}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="expression-icon-button"
                      onClick={() => onRenameFolderStart(folder)}
                      aria-label={`Rename folder ${folder.name}`}
                    >
                      <RenameIcon />
                    </button>
                    <button
                      type="button"
                      className="expression-icon-button"
                      onClick={() => onRemoveFolder(folder.id)}
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
                    onChange={onTabDraftChange}
                    onKeyDown={onTabDraftKeyDown}
                    onBlur={onTabDraftBlur}
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
  );
};
