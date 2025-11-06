import { MouseEvent as ReactMouseEvent } from 'react';
import type { JSX } from 'react';
import examples from '../examples';

type ExamplePopupProps = {
  open: boolean;
  currentId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function ExamplePopup({ open, currentId, onSelect, onClose }: ExamplePopupProps): JSX.Element | null {
  if (!open) {
    return null;
  }

  const handleBackgroundClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.currentTarget === event.target) {
      onClose();
    }
  };

  return (
    <div
      className="dialog-overlay"
      onClick={handleBackgroundClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="example-dialog-title"
    >
      <div className="dialog">
        <header className="dialog-header">
          <h2 id="example-dialog-title">Load Example</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close example list">
            ×
          </button>
        </header>
        <div className="dialog-body">
          <p className="dialog-description" style={{ marginBottom: 4 }}>
            Choose a preset to replace the current workspace.
          </p>
          <ul className="dialog-option-list">
            {examples.map((example) => {
              const active = currentId === example.id;
              const className = active
                ? 'dialog-option-button dialog-option-button-active'
                : 'dialog-option-button';
              return (
                <li key={example.id}>
                  <button type="button" className={className} onClick={() => onSelect(example.id)}>
                    {example.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <footer className="dialog-footer">
          <button type="button" className="control-button" onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}
