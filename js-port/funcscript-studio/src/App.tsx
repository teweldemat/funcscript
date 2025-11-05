import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { FuncScriptTester, type FuncScriptTesterVariableInput } from '@tewelde/funcscript-editor';

type StoredTestCase = {
  id: string;
  name: string;
  variables: FuncScriptTesterVariableInput[];
  updatedAt: string;
};

type StoredFormula = {
  id: string;
  name: string;
  expression: string;
  updatedAt: string;
  testCases: StoredTestCase[];
};

const FORMULA_STORAGE_KEY = 'funscript-studio:formulas';
const createStableId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return `${prefix}-${crypto.randomUUID()}`;
    } catch {
      // fall through
    }
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createFormulaId = () => createStableId('formula');
const createTestCaseId = () => createStableId('testcase');

const sanitizeVariables = (variables: FuncScriptTesterVariableInput[]): FuncScriptTesterVariableInput[] =>
  variables.map((variable) => ({
    name: typeof variable?.name === 'string' ? variable.name.trim() : '',
    expression: typeof variable?.expression === 'string' ? variable.expression : ''
  }));

const cloneVariables = (variables: FuncScriptTesterVariableInput[]): FuncScriptTesterVariableInput[] =>
  sanitizeVariables(variables);

const createVariablesSignature = (variables: FuncScriptTesterVariableInput[] | undefined): string =>
  JSON.stringify(sanitizeVariables(Array.isArray(variables) ? variables : []));

const createTestCasesSignature = (cases: StoredTestCase[] | undefined): string => {
  if (!cases || cases.length === 0) {
    return '[]';
  }
  const normalized = cases
    .map((testCase) => ({
      id: testCase.id,
      name: testCase.name,
      variables: sanitizeVariables(testCase.variables)
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return JSON.stringify(normalized);
};

const sortTestCases = (cases: StoredTestCase[]): StoredTestCase[] =>
  [...cases].sort((a, b) => {
    const dateCompare = b.updatedAt.localeCompare(a.updatedAt);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return a.id.localeCompare(b.id);
  });

const sortFormulas = (formulas: StoredFormula[]): StoredFormula[] =>
  [...formulas].sort((a, b) => {
    const dateCompare = b.updatedAt.localeCompare(a.updatedAt);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return a.id.localeCompare(b.id);
  });

const normalizeTestCases = (input: unknown): StoredTestCase[] => {
  if (!Array.isArray(input)) {
    return [];
  }
  const now = new Date().toISOString();
  const normalized: StoredTestCase[] = [];
  input.forEach((candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return;
    }
    const { id, name, variables, updatedAt } = candidate as Partial<StoredTestCase> & {
      variables?: unknown;
    };
    const safeName = typeof name === 'string' && name.trim().length > 0 ? name : 'Untitled';
    const parsedVariables = Array.isArray(variables)
      ? sanitizeVariables(variables as FuncScriptTesterVariableInput[])
      : [];
    normalized.push({
      id: typeof id === 'string' ? id : createTestCaseId(),
      name: safeName,
      variables: parsedVariables,
      updatedAt: typeof updatedAt === 'string' ? updatedAt : now
    });
  });
  return sortTestCases(normalized);
};

const loadSavedFormulas = (): StoredFormula[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(FORMULA_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const normalized: StoredFormula[] = [];
    parsed.forEach((entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const { id, name, expression, updatedAt, testCases } = entry as Partial<StoredFormula> & {
        testCases?: unknown;
      };
      if (typeof name !== 'string' || typeof expression !== 'string') {
        return;
      }
      normalized.push({
        id: typeof id === 'string' ? id : createFormulaId(),
        name,
        expression,
        updatedAt: typeof updatedAt === 'string' ? updatedAt : new Date().toISOString(),
        testCases: normalizeTestCases(testCases)
      });
    });
    return sortFormulas(normalized);
  } catch {
    return [];
  }
};

const persistSavedFormulas = (formulas: StoredFormula[]) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(FORMULA_STORAGE_KEY, JSON.stringify(formulas));
  } catch {
    // ignore
  }
};

const App = (): JSX.Element => {
  const initialFormulasRef = useRef<StoredFormula[] | null>(null);
  if (initialFormulasRef.current === null) {
    initialFormulasRef.current = loadSavedFormulas();
  }

  const initialFormulas = useMemo(() => initialFormulasRef.current ?? [], []);
  const [savedFormulas, setSavedFormulas] = useState<StoredFormula[]>(initialFormulas);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>('');
  const [expression, setExpression] = useState<string>('');
  const [savedTestCases, setSavedTestCases] = useState<StoredTestCase[]>([]);
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<string>('');
  const [testerVariablesPayload, setTesterVariablesPayload] = useState<
    FuncScriptTesterVariableInput[] | undefined
  >(undefined);
  const latestTesterVariablesRef = useRef<FuncScriptTesterVariableInput[]>([]);
  const initialTestCasesSignatureRef = useRef('[]');

  useEffect(() => {
    if (initialFormulas.length === 0) {
      return;
    }
    const first = initialFormulas[0];
    setSelectedFormulaId(first.id);
    setExpression(first.expression);
    const normalizedCases = sortTestCases(first.testCases.length ? first.testCases : []);
    setSavedTestCases(normalizedCases);
    const firstCase = normalizedCases[0];
    setSelectedTestCaseId(firstCase?.id ?? '');
    const baseVariables = cloneVariables(firstCase?.variables ?? []);
    latestTesterVariablesRef.current = baseVariables;
    setTesterVariablesPayload(baseVariables.length > 0 ? baseVariables : []);
    initialTestCasesSignatureRef.current = createTestCasesSignature(normalizedCases);
  }, [initialFormulas]);

  useEffect(() => {
    persistSavedFormulas(savedFormulas);
  }, [savedFormulas]);

  const selectedFormula = useMemo(
    () => savedFormulas.find((formula) => formula.id === selectedFormulaId) ?? null,
    [savedFormulas, selectedFormulaId]
  );

  const selectedTestCase = useMemo(
    () => savedTestCases.find((testCase) => testCase.id === selectedTestCaseId) ?? null,
    [savedTestCases, selectedTestCaseId]
  );

  const stagedTestCasesSignature = useMemo(
    () => createTestCasesSignature(savedTestCases),
    [savedTestCases]
  );

  const testCaseCount = savedTestCases.length;

  const persistedTestCasesSignature = useMemo(
    () => createTestCasesSignature(selectedFormula?.testCases ?? []),
    [selectedFormula]
  );

  const initialTestCasesSignature = initialTestCasesSignatureRef.current;

  const isDirty = useMemo(() => {
    if (!selectedFormula) {
      return (
        expression.trim().length > 0 ||
        stagedTestCasesSignature !== initialTestCasesSignature
      );
    }
    return (
      expression !== selectedFormula.expression ||
      stagedTestCasesSignature !== persistedTestCasesSignature
    );
  }, [
    expression,
    selectedFormula,
    stagedTestCasesSignature,
    persistedTestCasesSignature,
    initialTestCasesSignature
  ]);

  const handleExpressionChange = useCallback((next: string) => {
    setExpression(next);
  }, []);

  const handleSelectFormula = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextId = event.target.value;
      if (!nextId) {
        setSelectedFormulaId('');
        setExpression('');
        setSavedTestCases([]);
        setSelectedTestCaseId('');
        latestTesterVariablesRef.current = [];
        setTesterVariablesPayload([]);
        initialTestCasesSignatureRef.current = '[]';
        return;
      }
      const match = savedFormulas.find((formula) => formula.id === nextId);
      if (!match) {
        return;
      }
      setSelectedFormulaId(match.id);
      setExpression(match.expression);
      const nextTestCases = match.testCases.length ? sortTestCases(match.testCases) : [];
      setSavedTestCases(nextTestCases);
      const nextSelected = nextTestCases[0];
      setSelectedTestCaseId(nextSelected?.id ?? '');
      const baseVariables = cloneVariables(nextSelected?.variables ?? []);
      latestTesterVariablesRef.current = baseVariables;
      setTesterVariablesPayload(baseVariables.length > 0 ? baseVariables : []);
    },
    [savedFormulas]
  );

  const handleSaveFormula = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const defaultName = selectedFormula?.name ?? '';
    const proposedName = window.prompt('Save formula as…', defaultName || 'New Formula');
    if (!proposedName) {
      return;
    }
    const trimmedName = proposedName.trim();
    if (!trimmedName) {
      return;
    }
    const timestamp = new Date().toISOString();
    const sortedCases = sortTestCases(savedTestCases);
    let resultingSelectionId = selectedFormulaId;
    const wasNewFormula = selectedFormulaId === '';

    setSavedFormulas((previous) => {
      const existingIndex = previous.findIndex(
        (formula) => formula.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (existingIndex >= 0) {
        const updated = [...previous];
        const original = updated[existingIndex];
        const updatedEntry: StoredFormula = {
          ...original,
          name: trimmedName,
          expression,
          updatedAt: timestamp,
          testCases: sortedCases
        };
        updated[existingIndex] = updatedEntry;
        resultingSelectionId = updatedEntry.id;
        return sortFormulas(updated);
      }
      const newEntry: StoredFormula = {
        id: createFormulaId(),
        name: trimmedName,
        expression,
        updatedAt: timestamp,
        testCases: sortedCases
      };
      resultingSelectionId = newEntry.id;
      return sortFormulas([...previous, newEntry]);
    });

    if (wasNewFormula) {
      setSelectedFormulaId('');
      setExpression('');
      setSavedTestCases([]);
      setSelectedTestCaseId('');
      latestTesterVariablesRef.current = [];
      setTesterVariablesPayload([]);
      initialTestCasesSignatureRef.current = '[]';
    } else {
      setSelectedFormulaId(resultingSelectionId);
    }
  }, [expression, savedTestCases, selectedFormula, selectedFormulaId]);

  const handleVariablesChange = useCallback(
    (next: FuncScriptTesterVariableInput[]) => {
      const sanitized = sanitizeVariables(next);
      const signature = createVariablesSignature(sanitized);
      latestTesterVariablesRef.current = sanitized;

      if (selectedTestCaseId) {
        setSavedTestCases((previous) => {
          const index = previous.findIndex((testCase) => testCase.id === selectedTestCaseId);
          if (index < 0) {
            return previous;
          }
          const currentSignature = createVariablesSignature(previous[index].variables);
          if (currentSignature === signature) {
            return previous;
          }
          const updated = [...previous];
          updated[index] = {
            ...previous[index],
            variables: sanitized
          };
          return updated;
        });
      }
    },
    [selectedTestCaseId]
  );

  const handleSelectTestCase = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextId = event.target.value;
      setSelectedTestCaseId(nextId);
      const match = savedTestCases.find((testCase) => testCase.id === nextId);
      const baseVariables = cloneVariables(match?.variables ?? []);
      latestTesterVariablesRef.current = baseVariables;
      setTesterVariablesPayload(baseVariables.length > 0 ? baseVariables : []);
    },
    [savedTestCases]
  );

  const getUniqueTestCaseName = useCallback(
    (desired: string, excludeId?: string) => {
      const base = desired.trim();
      if (!base) {
        return '';
      }
      const existing = new Set(
        savedTestCases
          .filter((testCase) => testCase.id !== excludeId)
          .map((testCase) => testCase.name.toLowerCase())
      );
      let candidate = base;
      let suffix = 2;
      while (existing.has(candidate.toLowerCase())) {
        candidate = `${base} (${suffix})`;
        suffix += 1;
      }
      return candidate;
    },
    [savedTestCases]
  );

  
  const handleCreateTestCase = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const defaultName = getUniqueTestCaseName('New Test Case');
    const proposed = window.prompt('Name for the new test case', defaultName);
    if (proposed === null) {
      return;
    }
    const trimmed = proposed.trim();
    if (!trimmed) {
      return;
    }
    const name = getUniqueTestCaseName(trimmed);
    const timestamp = new Date().toISOString();
    const variables = cloneVariables(latestTesterVariablesRef.current);
    const newTestCase: StoredTestCase = {
      id: createTestCaseId(),
      name,
      variables,
      updatedAt: timestamp
    };
    setSavedTestCases((previous) => sortTestCases([...previous, newTestCase]));
    setSelectedTestCaseId(newTestCase.id);
    setTesterVariablesPayload(variables.length > 0 ? variables : []);
  }, [getUniqueTestCaseName]);

  const handleDuplicateTestCase = useCallback(() => {
    if (!selectedTestCase || typeof window === 'undefined') {
      return;
    }
    const defaultName = getUniqueTestCaseName(`${selectedTestCase.name} Copy`);
    const proposed = window.prompt('Name for the duplicated test case', defaultName);
    if (proposed === null) {
      return;
    }
    const trimmed = proposed.trim();
    if (!trimmed) {
      return;
    }
    const name = getUniqueTestCaseName(trimmed);
    const timestamp = new Date().toISOString();
    const variables = cloneVariables(latestTesterVariablesRef.current);
    const duplicated: StoredTestCase = {
      id: createTestCaseId(),
      name,
      variables,
      updatedAt: timestamp
    };
    setSavedTestCases((previous) => sortTestCases([...previous, duplicated]));
    setSelectedTestCaseId(duplicated.id);
    setTesterVariablesPayload(variables.length > 0 ? variables : []);
  }, [selectedTestCase, getUniqueTestCaseName]);

const handleRenameTestCase = useCallback(() => {
    if (!selectedTestCase || typeof window === 'undefined') {
      return;
    }
    const proposed = window.prompt('Rename test case', selectedTestCase.name);
    if (proposed === null) {
      return;
    }
    const trimmed = proposed.trim();
    if (!trimmed) {
      return;
    }
    const name = getUniqueTestCaseName(trimmed, selectedTestCase.id);
    if (name === selectedTestCase.name) {
      return;
    }
    const timestamp = new Date().toISOString();
    const targetId = selectedTestCase.id;
    setSavedTestCases((previous) => {
      const index = previous.findIndex((testCase) => testCase.id === targetId);
      if (index < 0) {
        return previous;
      }
      const updated = [...previous];
      updated[index] = {
        ...previous[index],
        name,
        updatedAt: timestamp
      };
      return sortTestCases(updated);
    });
    setSelectedTestCaseId(targetId);
  }, [selectedTestCase, getUniqueTestCaseName]);

const handleDeleteTestCase = useCallback(() => {
    if (!selectedTestCase || testCaseCount <= 1) {
      return;
    }
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Delete the test case "${selectedTestCase.name}"?`);
      if (!confirmed) {
        return;
      }
    }
    setSavedTestCases((previous) => {
      const remaining = previous.filter((testCase) => testCase.id !== selectedTestCase.id);
      const sorted = sortTestCases(remaining);
      const nextSelected = sorted[0]?.id ?? '';
      setSelectedTestCaseId(nextSelected);
      const nextMatch = sorted.find((testCase) => testCase.id === nextSelected);
      const baseVariables = cloneVariables(nextMatch?.variables ?? []);
      latestTesterVariablesRef.current = baseVariables;
      setTesterVariablesPayload(baseVariables.length > 0 ? baseVariables : []);
      return sorted;
    });
  }, [selectedTestCase, testCaseCount]);

  const testerSaveKey = useMemo(
    () => `funscript-studio:tester:${selectedFormulaId || 'default'}`,
    [selectedFormulaId]
  );

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>FuncScript Tester</h1>
        <div className="formula-controls">
          <label className="formula-select-group" aria-label="Load saved formula">
            <span className="formula-label">Load</span>
            <select
              className="formula-select"
              value={selectedFormulaId}
              onChange={handleSelectFormula}
            >
              <option value="">New Formula</option>
              {savedFormulas.map((formula) => (
                <option key={formula.id} value={formula.id}>
                  {formula.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="save-button"
            onClick={handleSaveFormula}
            disabled={!isDirty}
          >
            <span className="save-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" focusable="false" role="img">
                <path
                  d="M4.75 2.5h8.69c.2 0 .39.08.53.22l3.31 3.31c.14.14.22.33.22.53v10.72c0 .83-.67 1.5-1.5 1.5H4.75c-.83 0-1.5-.67-1.5-1.5V4c0-.83.67-1.5 1.5-1.5Zm5.5 2.25H5.88c-.2 0-.38.16-.38.38v3.25c0 .21.17.37.38.37h4.37c.2 0 .37-.16.37-.37V5.13c0-.22-.17-.38-.37-.38Zm3.5 0H13c-.21 0-.38.17-.38.38v3.25c0 .21.17.37.38.37h.75c.41 0 .75-.34.75-.75V4.75c0-.41-.34-.75-.75-.75Zm-6.5 7.5c-.62 0-1.13.5-1.13 1.12v3.01c0 .62.51 1.12 1.13 1.12h4.5c.62 0 1.12-.5 1.12-1.12v-3c0-.63-.5-1.13-1.12-1.13h-4.5Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span>Save</span>
          </button>
        </div>
      </header>
      <div className="tester-wrapper">
        <div className="tester-shell">
          <FuncScriptTester
            value={expression}
            onChange={handleExpressionChange}
            saveKey={testerSaveKey}
            variables={testerVariablesPayload}
            onVariablesChange={handleVariablesChange}
          />
        </div>
        <aside className="testcase-panel">
          <div className="testcase-panel__header">
            <h2>Test Cases</h2>
            <p>Save reusable variable sets for this formula.</p>
          </div>
          <div className="testcase-panel__controls">
            <label className="testcase-select-group" aria-label="Select test case">
              <span className="testcase-label">Saved Cases</span>
              <select
                className="testcase-select"
                value={selectedTestCaseId}
                onChange={handleSelectTestCase}
              >
                {savedTestCases.map((testCase) => (
                  <option key={testCase.id} value={testCase.id}>
                    {testCase.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="testcase-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={handleCreateTestCase}
                title="New test case"
                aria-label="New test case"
              >
                ＋
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={handleDuplicateTestCase}
                disabled={!selectedTestCase}
                title="Duplicate test case"
                aria-label="Duplicate test case"
              >
                ⧉
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={handleRenameTestCase}
                disabled={!selectedTestCase}
                title="Rename test case"
                aria-label="Rename test case"
              >
                ✎
              </button>
              <button
                type="button"
                className="ghost-button danger"
                onClick={handleDeleteTestCase}
                disabled={!selectedTestCase || testCaseCount <= 1}
                title="Delete test case"
                aria-label="Delete test case"
              >
                🗑
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default App;
