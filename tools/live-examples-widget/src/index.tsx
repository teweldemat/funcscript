import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FuncScriptEditor } from '@tewelde/funcscript-editor';
import { Engine, FSDataType, type TypedValue } from '@tewelde/funcscript/browser';

declare global {
  interface Window {
    document$?: {
      subscribe: (callback: (doc?: Document) => void) => void;
    };
  }
}

type EvaluationState =
  | {
      status: 'empty';
    }
  | {
      status: 'success';
      formatted: string;
      typeName: string;
    }
  | {
    status: 'error';
    message: string;
  };

type ExampleConfig = {
  id: string;
  container: HTMLElement;
  expression: string;
  editorHeight?: number;
};

type PlainValue = unknown;

const typedValueToPlain = (typedValue: TypedValue): PlainValue => {
  const valueType = Engine.typeOf(typedValue);
  const rawValue = Engine.valueOf(typedValue as TypedValue<unknown>);

  switch (valueType) {
    case FSDataType.Null:
    case FSDataType.Boolean:
    case FSDataType.Integer:
    case FSDataType.BigInteger:
    case FSDataType.Float:
    case FSDataType.String:
    case FSDataType.Guid:
      return rawValue;
    case FSDataType.List:
      if (
        rawValue &&
        typeof (rawValue as { toArray?: () => TypedValue[] }).toArray === 'function'
      ) {
        return (rawValue as { toArray: () => TypedValue[] })
          .toArray()
          .map((entry) => typedValueToPlain(entry));
      }
      return rawValue;
    case FSDataType.KeyValueCollection:
      if (
        rawValue &&
        typeof (rawValue as { getAll?: () => Array<readonly [string, TypedValue]> }).getAll ===
          'function'
      ) {
        const entries = (rawValue as {
          getAll: () => Array<readonly [string, TypedValue]>;
        }).getAll();
        const result: Record<string, PlainValue> = {};
        for (const [key, value] of entries) {
          result[key] = typedValueToPlain(value);
        }
        return result;
      }
      return rawValue;
    default:
      return rawValue;
  }
};

const formatPlainValue = (value: PlainValue): string => {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    if (typeof value === 'object' && value && 'toString' in value) {
      return String((value as { toString: () => string }).toString());
    }
    return String(value);
  }
};

const evaluateExpression = (source: string): EvaluationState => {
  const trimmed = source.trim();
  if (!trimmed) {
    return { status: 'empty' };
  }
  try {
    const typedValue = Engine.evaluate(trimmed, new Engine.DefaultFsDataProvider());
    const formatted = formatPlainValue(typedValueToPlain(typedValue));
    const typeName = Engine.getTypeName(Engine.typeOf(typedValue));
    return {
      status: 'success',
      formatted,
      typeName
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      message
    };
  }
};

const normalizeSnippet = (content: string): string => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }
  while (lines.length && !lines[lines.length - 1].trim()) {
    lines.pop();
  }
  const indent = lines.reduce<number | null>((acc, line) => {
    if (!line.trim()) {
      return acc;
    }
    const currentIndent = line.match(/^\s*/)?.[0].length ?? 0;
    if (acc === null) {
      return currentIndent;
    }
    return Math.min(acc, currentIndent);
  }, null);
  if (!lines.length) {
    return '';
  }
  if (!indent || indent <= 0) {
    return lines.join('\n');
  }
  const amount = Math.max(0, indent);
  return lines
    .map((line) => {
      if (!line.trim()) {
        return '';
      }
      return line.slice(Math.min(amount, line.length));
    })
    .join('\n');
};

const normalizeCode = (content: string): string => {
  const cleaned = content.replace(/\u00a0/g, ' ');
  const normalized = normalizeSnippet(cleaned);
  return normalized;
};

const LiveExample = ({
  expression,
  editorHeight
}: {
  expression: string;
  editorHeight?: number;
}) => {
  const initialValueRef = useRef(expression);
  const [value, setValue] = useState(expression);
  const [parseError, setParseError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationState>(() =>
    evaluateExpression(expression)
  );

  useEffect(() => {
    initialValueRef.current = expression;
    setValue(expression);
    setParseError(null);
    setEvaluation(evaluateExpression(expression));
  }, [expression]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      setEvaluation(evaluateExpression(value));
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [value]);

  const handleReset = useCallback(() => {
    setValue(initialValueRef.current);
  }, []);

  const isDirty = useMemo(() => value !== initialValueRef.current, [value]);

  return (
    <div className="fs-live-widget">
      <div className="fs-live-widget__header">
        <span>Live editor</span>
        <div className="fs-live-widget__buttons">
          <button
            type="button"
            className="fs-live-widget__reset-button"
            onClick={handleReset}
            disabled={!isDirty}
          >
            Reset example
          </button>
        </div>
      </div>
      <FuncScriptEditor
        value={value}
        onChange={setValue}
        onError={setParseError}
        minHeight={editorHeight ?? 260}
      />
      <div className="fs-live-widget__result-card">
        <div className="fs-live-widget__result-heading">
          <span>Live result</span>
          {evaluation.status === 'success' && (
            <span className="fs-live-widget__type-pill">{evaluation.typeName}</span>
          )}
        </div>
        <pre
          className={`fs-live-widget__result-output${
            evaluation.status === 'error' ? ' fs-live-widget__result-output--error' : ''
          }`}
        >
          <code>
            {evaluation.status === 'success'
              ? evaluation.formatted
              : evaluation.status === 'error'
              ? evaluation.message
              : ''}
          </code>
        </pre>
        {parseError && (
          <div className="fs-live-widget__error-callout">{parseError}</div>
        )}
        {evaluation.status === 'empty' && (
          <div className="fs-live-widget__status-note">Start typing to evaluate this snippet.</div>
        )}
      </div>
    </div>
  );
};

const getCodeText = (codeBlock: Element | null): string => {
  if (!codeBlock) {
    return '';
  }
  return normalizeCode(codeBlock.textContent ?? '');
};

const collectExamples = (): ExampleConfig[] => {
  const containers = Array.from(
    document.querySelectorAll<HTMLElement>('.fs-live-example[data-example-id]')
  );
  return containers
    .map((container) => {
      const id = container.dataset.exampleId?.trim();
      if (!id) {
        return null;
      }
      const codeBlocks = Array.from(container.querySelectorAll('code'));
      const expressionBlock = codeBlocks.find((block) =>
        Array.from(block.classList).some((cls) => cls.includes('language-funcscript'))
      );
      const resultBlock = codeBlocks.find((block) =>
        block !== expressionBlock && Array.from(block.classList).some((cls) => cls.startsWith('language-'))
      );
      if (!expressionBlock || !resultBlock) {
        return null;
      }
      const expression = getCodeText(expressionBlock);
      const editorHeightAttr = container.dataset.editorHeight;
      const parsedHeight = editorHeightAttr ? Number(editorHeightAttr) : undefined;
      const editorHeight = Number.isFinite(parsedHeight) && parsedHeight
        ? Math.max(200, parsedHeight)
        : undefined;
      return {
        id,
        container,
        expression,
        editorHeight
      };
    })
    .filter((config): config is ExampleConfig => Boolean(config));
};

const bootstrap = () => {
  const examples = collectExamples();
  if (!examples.length) {
    return;
  }
  examples.forEach((example) => {
    if (example.container.dataset.fsHydrated === 'true') {
      return;
    }
    const host = document.createElement('div');
    host.className = 'fs-live-widget';
    example.container.appendChild(host);
    const root = createRoot(host);
    root.render(
      <LiveExample expression={example.expression} editorHeight={example.editorHeight} />
    );
    example.container.dataset.fsHydrated = 'true';
    example.container.classList.add('fs-live-example--hydrated');
  });
};

const run = () => {
  if (typeof document === 'undefined') {
    return;
  }
  bootstrap();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', run, { once: true });
} else {
  run();
}

window.document$?.subscribe(() => run());
