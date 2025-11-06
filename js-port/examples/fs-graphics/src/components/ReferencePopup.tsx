import { ChangeEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { JSX } from 'react';
import { PRIMITIVE_REFERENCE } from '../reference';

type ReferencePopupProps = {
  open: boolean;
  selection: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

export function ReferencePopup({ open, selection, onSelect, onClose }: ReferencePopupProps): JSX.Element | null {
  if (!open) {
    return null;
  }

  const current = PRIMITIVE_REFERENCE.find((entry) => entry.name === selection) ?? PRIMITIVE_REFERENCE[0] ?? null;

  const handleBackgroundClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.currentTarget === event.target) {
      onClose();
    }
  };

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onSelect(event.target.value);
  };

  return (
    <div
      className="dialog-overlay"
      onClick={handleBackgroundClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reference-title"
    >
      <div className="dialog">
        <header className="dialog-header">
          <h2 id="reference-title">Reference</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close reference">
            ×
          </button>
        </header>
        <div className="dialog-body">
          <label className="input-label" htmlFor="reference-select">
            Topic
          </label>
          <select
            id="reference-select"
            className="dialog-select"
            value={current?.name ?? ''}
            onChange={handleSelectChange}
          >
            {PRIMITIVE_REFERENCE.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.title}
              </option>
            ))}
          </select>
          {current ? (
            <article className="dialog-card">
              <p className="dialog-description">{current.description}</p>
              <pre className="dialog-example">
                <code>{current.example}</code>
              </pre>
            </article>
          ) : (
            <p className="dialog-empty">No topics available.</p>
          )}
          <p className="dialog-reference-link">
            <a href="https://teweldemat.github.io/funcscript/" target="_blank" rel="noopener noreferrer">
              Open the full FuncScript language reference on GitHub
            </a>
          </p>
        </div>
        <footer className="dialog-footer">
          <button type="button" className="control-button" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
