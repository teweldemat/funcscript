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
const composeTesterSaveKey = (formulaId: string) =>
  `funscript-studio:tester:${formulaId || 'default'}`;
const testerStorageKey = (formulaId: string) =>
  `funcscript-tester:${composeTesterSaveKey(formulaId)}`;
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
    const nameCompare = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (nameCompare !== 0) {
      return nameCompare;
    }
    return a.id.localeCompare(b.id);
  });

const sortFormulas = (formulas: StoredFormula[]): StoredFormula[] =>
  [...formulas].sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (nameCompare !== 0) {
      return nameCompare;
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
  const [isTestCaseDrawerOpen, setIsTestCaseDrawerOpen] = useState<boolean>(false);
  const [openContextMenuId, setOpenContextMenuId] = useState<string | null>(null);
  const [testerVariablesPayload, setTesterVariablesPayload] = useState<
    FuncScriptTesterVariableInput[] | undefined
  >(undefined);
  const [testerResetToken, setTesterResetToken] = useState(0);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
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

  const getUniqueFormulaName = useCallback(
    (desired: string, excludeId?: string) => {
      const base = desired.trim();
      if (!base || base.toLowerCase() === 'new formula') {
        return '';
      }
      const existing = new Set(
        savedFormulas
          .filter((formula) => formula.id !== excludeId)
          .map((formula) => formula.name.toLowerCase())
      );
      let candidate = base;
      let suffix = 2;
      while (existing.has(candidate.toLowerCase())) {
        candidate = `${base} (${suffix})`;
        suffix += 1;
      }
      return candidate;
    },
    [savedFormulas]
  );

  const getNextUntitledFormulaName = useCallback(() => {
    const existing = new Set(savedFormulas.map((formula) => formula.name.toLowerCase()));
    let suffix = 1;
    let candidate = `Untitled ${suffix}`;
    while (existing.has(candidate.toLowerCase())) {
      suffix += 1;
      candidate = `Untitled ${suffix}`;
    }
    return candidate;
  }, [savedFormulas]);

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

  const activateFormulaState = useCallback(
    (testCases: StoredTestCase[]) => {
      const normalizedCases = sortTestCases(testCases);
      setSavedTestCases(normalizedCases);
      const firstCase = normalizedCases[0];
      setSelectedTestCaseId(firstCase?.id ?? '');
      const baseVariables = cloneVariables(firstCase?.variables ?? []);
      latestTesterVariablesRef.current = baseVariables;
      setTesterVariablesPayload(baseVariables.length > 0 ? baseVariables : []);
      initialTestCasesSignatureRef.current = createTestCasesSignature(normalizedCases);
    },
    []
  );

  const resetTestingMode = useCallback((formulaId: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    const storageKey = testerStorageKey(formulaId);
    try {
      const raw = window.localStorage.getItem(storageKey);
      let mode: 'standard' | 'tree' = 'standard';
      if (raw) {
        const parsed = JSON.parse(raw) as { mode?: unknown } | null;
        if (parsed && typeof parsed === 'object' && parsed.mode === 'tree') {
          mode = 'tree';
        }
      }
      window.localStorage.setItem(storageKey, JSON.stringify({ mode, showTesting: false }));
    } catch {
      // ignore storage issues (e.g. quota, private mode)
    }
    setTesterResetToken((previous) => previous + 1);
  }, []);

  const handleSaveFormula = useCallback(() => {
    const sortedCases = sortTestCases(savedTestCases);

    if (selectedFormulaId === '') {
      if (typeof window === 'undefined') {
        return;
      }
      const defaultName = getNextUntitledFormulaName();
      const proposed = window.prompt('Name for the new formula', defaultName);
      if (proposed === null) {
        return;
      }
      const trimmed = proposed.trim();
      if (!trimmed) {
        return;
      }
      const name = getUniqueFormulaName(trimmed);
      const timestamp = new Date().toISOString();
      const newEntry: StoredFormula = {
        id: createFormulaId(),
        name,
        expression,
        updatedAt: timestamp,
        testCases: sortedCases
      };
      setSavedFormulas((previous) => sortFormulas([...previous, newEntry]));
      setSelectedFormulaId(newEntry.id);
      setExpression(expression);
      activateFormulaState(sortedCases);
      resetTestingMode(newEntry.id);
      return;
    }

    const timestamp = new Date().toISOString();
    setSavedFormulas((previous) => {
      const index = previous.findIndex((formula) => formula.id === selectedFormulaId);
      if (index < 0) {
        return previous;
      }
      const updated = [...previous];
      updated[index] = {
        ...previous[index],
        expression,
        updatedAt: timestamp,
        testCases: sortedCases
      };
      return sortFormulas(updated);
    });
    activateFormulaState(sortedCases);
    resetTestingMode(selectedFormulaId);
  }, [
    expression,
    savedTestCases,
    selectedFormulaId,
    getUniqueFormulaName,
    getNextUntitledFormulaName,
    activateFormulaState,
    resetTestingMode
  ]);

  const handleSaveFormulaAs = useCallback(() => {
    const sortedCases = sortTestCases(savedTestCases);
    if (typeof window === 'undefined') {
      return;
    }
    const defaultName = getNextUntitledFormulaName();
    const proposed = window.prompt('Name for the new formula', defaultName);
    if (proposed === null) {
      return;
    }
    const trimmed = proposed.trim();
    if (!trimmed) {
      return;
    }
    const name = getUniqueFormulaName(trimmed);
    const timestamp = new Date().toISOString();
    const newEntry: StoredFormula = {
      id: createFormulaId(),
      name,
      expression,
      updatedAt: timestamp,
      testCases: sortedCases
    };
    setSavedFormulas((previous) => sortFormulas([...previous, newEntry]));
    setSelectedFormulaId(newEntry.id);
    activateFormulaState(sortedCases);
    resetTestingMode(newEntry.id);
  }, [expression, savedTestCases, getUniqueFormulaName, getNextUntitledFormulaName, activateFormulaState, resetTestingMode]);

  const handleDuplicateFormula = useCallback(() => {
    if (!selectedFormula || typeof window === 'undefined') {
      return;
    }
    const defaultName = getUniqueFormulaName(`${selectedFormula.name} Copy`);
    const proposed = window.prompt('Name for the duplicated formula', defaultName);
    if (proposed === null) {
      return;
    }
    const trimmed = proposed.trim();
    if (!trimmed) {
      return;
    }
    const name = getUniqueFormulaName(trimmed);
    const timestamp = new Date().toISOString();
    const clonedTestCases = sortTestCases(
      (selectedFormula.testCases ?? []).map((testCase) => ({
        id: createTestCaseId(),
        name: testCase.name,
        variables: cloneVariables(testCase.variables),
        updatedAt: timestamp
      }))
    );
    const duplicated: StoredFormula = {
      id: createFormulaId(),
      name,
      expression: selectedFormula.expression,
      updatedAt: timestamp,
      testCases: clonedTestCases
    };
    setSavedFormulas((previous) => sortFormulas([...previous, duplicated]));
    setSelectedFormulaId(duplicated.id);
    setExpression(duplicated.expression);
    activateFormulaState(clonedTestCases);
  }, [selectedFormula, getUniqueFormulaName, activateFormulaState]);
  const handleRenameFormula = useCallback(() => {
    if (!selectedFormula || typeof window === 'undefined') {
      return;
    }
    const proposed = window.prompt('Rename formula', selectedFormula.name);
    if (proposed === null) {
      return;
    }
    const trimmed = proposed.trim();
    if (!trimmed) {
      return;
    }
    const name = getUniqueFormulaName(trimmed, selectedFormula.id);
    if (!name || name === selectedFormula.name) {
      return;
    }
    const timestamp = new Date().toISOString();
    const targetId = selectedFormula.id;
    setSavedFormulas((previous) => {
      const index = previous.findIndex((formula) => formula.id === targetId);
      if (index < 0) {
        return previous;
      }
      const updated = [...previous];
      updated[index] = {
        ...previous[index],
        name,
        updatedAt: timestamp
      };
      return sortFormulas(updated);
    });
    setSelectedFormulaId(targetId);
  }, [selectedFormula, getUniqueFormulaName]);

  const handleDeleteFormula = useCallback(() => {
    if (!selectedFormula || typeof window === 'undefined') {
      return;
    }
    const confirmed = window.confirm(`Delete the formula "${selectedFormula.name}"?`);
    if (!confirmed) {
      return;
    }
    const remaining = sortFormulas(
      savedFormulas.filter((formula) => formula.id !== selectedFormula.id)
    );
    setSavedFormulas(remaining);
    if (remaining.length === 0) {
      setSelectedFormulaId('');
      setExpression('');
      setSavedTestCases([]);
      setSelectedTestCaseId('');
      latestTesterVariablesRef.current = [];
      setTesterVariablesPayload([]);
      initialTestCasesSignatureRef.current = '[]';
      return;
    }
    const nextFormula = remaining[0];
    setSelectedFormulaId(nextFormula.id);
    setExpression(nextFormula.expression);
    const normalizedCases = sortTestCases(nextFormula.testCases);
    setSavedTestCases(normalizedCases);
    const firstCase = normalizedCases[0];
    setSelectedTestCaseId(firstCase?.id ?? '');
    const baseVariables = cloneVariables(firstCase?.variables ?? []);
    latestTesterVariablesRef.current = baseVariables;
    setTesterVariablesPayload(baseVariables.length > 0 ? baseVariables : []);
    initialTestCasesSignatureRef.current = createTestCasesSignature(normalizedCases);
  }, [selectedFormula, savedFormulas]);


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
    (testCaseId: string) => {
      setSelectedTestCaseId(testCaseId);
      const match = savedTestCases.find((testCase) => testCase.id === testCaseId);
      const baseVariables = cloneVariables(match?.variables ?? []);
      latestTesterVariablesRef.current = baseVariables;
      setTesterVariablesPayload(baseVariables.length > 0 ? baseVariables : []);
      setOpenContextMenuId(null);
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

  useEffect(() => {
    if (!expression.trim()) {
      return;
    }
    if (selectedTestCaseId || testCaseCount > 0) {
      return;
    }
    const name = getUniqueTestCaseName('Saved Variables');
    if (!name) {
      return;
    }
    const timestamp = new Date().toISOString();
    const variables = cloneVariables(latestTesterVariablesRef.current);
    const newTestCase: StoredTestCase = {
      id: createTestCaseId(),
      name,
      variables,
      updatedAt: timestamp
    };
    setSavedTestCases([newTestCase]);
    setSelectedTestCaseId(newTestCase.id);
    latestTesterVariablesRef.current = variables;
    setTesterVariablesPayload(variables.length > 0 ? variables : []);
  }, [expression, selectedTestCaseId, testCaseCount, getUniqueTestCaseName]);

  const handleCreateTestCase = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const defaultName = getUniqueTestCaseName('Saved Variables');
    const proposed = window.prompt('Name for the saved variables set', defaultName);
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

  const resolveTestCaseById = useCallback(
    (id?: string) => savedTestCases.find((testCase) => testCase.id === (id ?? selectedTestCaseId)) ?? null,
    [savedTestCases, selectedTestCaseId]
  );

  const handleDuplicateTestCase = useCallback(
    (targetId?: string) => {
      const source = resolveTestCaseById(targetId);
      if (!source || typeof window === 'undefined') {
        return;
      }
    const defaultName = getUniqueTestCaseName(`${source.name} Copy`);
    const proposed = window.prompt('Name for the duplicated saved variables', defaultName);
    if (proposed === null) {
      return;
    }
    const trimmed = proposed.trim();
    if (!trimmed) {
      return;
    }
    const name = getUniqueTestCaseName(trimmed);
    const timestamp = new Date().toISOString();
    const variables = cloneVariables(source.variables);
    const duplicated: StoredTestCase = {
      id: createTestCaseId(),
      name,
      variables,
      updatedAt: timestamp
    };
    setSavedTestCases((previous) => sortTestCases([...previous, duplicated]));
    setSelectedTestCaseId(duplicated.id);
    setTesterVariablesPayload(variables.length > 0 ? variables : []);
      setOpenContextMenuId(null);
    },
    [resolveTestCaseById, getUniqueTestCaseName]
  );

  const handleRenameTestCase = useCallback(
    (targetId?: string) => {
      const target = resolveTestCaseById(targetId);
      if (!target || typeof window === 'undefined') {
      return;
      }
      const proposed = window.prompt('Rename saved variables', target.name);
    if (proposed === null) {
      return;
    }
    const trimmed = proposed.trim();
    if (!trimmed) {
      return;
    }
      const name = getUniqueTestCaseName(trimmed, target.id);
      if (name === target.name) {
      return;
    }
    const timestamp = new Date().toISOString();
      const resolvedId = target.id;
    setSavedTestCases((previous) => {
        const index = previous.findIndex((testCase) => testCase.id === resolvedId);
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
      setSelectedTestCaseId(resolvedId);
      setOpenContextMenuId(null);
    },
    [resolveTestCaseById, getUniqueTestCaseName]
  );

  const handleDeleteTestCase = useCallback(
    (targetId?: string) => {
      const target = resolveTestCaseById(targetId);
      if (!target) {
      return;
    }
      if (savedTestCases.length <= 1) {
        return;
      }
    if (typeof window !== 'undefined') {
        const confirmed = window.confirm(`Delete the saved variables "${target.name}"?`);
      if (!confirmed) {
        return;
      }
    }
    setSavedTestCases((previous) => {
        const remaining = previous.filter((testCase) => testCase.id !== target.id);
      const sorted = sortTestCases(remaining);
        const nextSelected =
          target.id === selectedTestCaseId ? sorted[0]?.id ?? '' : selectedTestCaseId;
      setSelectedTestCaseId(nextSelected);
      const nextMatch = sorted.find((testCase) => testCase.id === nextSelected);
      const baseVariables = cloneVariables(nextMatch?.variables ?? []);
      latestTesterVariablesRef.current = baseVariables;
      setTesterVariablesPayload(baseVariables.length > 0 ? baseVariables : []);
      return sorted;
    });
      setOpenContextMenuId(null);
    },
    [resolveTestCaseById, selectedTestCaseId, savedTestCases.length]
  );

  const testerSaveKey = useMemo(
    () => composeTesterSaveKey(selectedFormulaId),
    [selectedFormulaId]
  );
  const testerComponentKey = useMemo(
    () => `${testerSaveKey}:${testerResetToken}`,
    [testerSaveKey, testerResetToken]
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const closeMenu = () => setOpenContextMenuId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  return (
    <div className="app-root">
      <header className="app-header">
        <h1 className="app-title">FuncScript Tester</h1>
        <div className="formula-controls">
          <select
            className="formula-select"
            value={selectedFormulaId}
            onChange={handleSelectFormula}
            aria-label="Select formula"
          >
            <option value="">New Formula</option>
            {savedFormulas.map((formula) => (
              <option key={formula.id} value={formula.id}>
                {formula.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="save-button"
            onClick={handleSaveFormula}
            disabled={!isDirty}
            title="Save formula"
            aria-label="Save formula"
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
          <button
            type="button"
            className="save-button secondary"
            onClick={handleSaveFormulaAs}
            disabled={expression.trim().length === 0 && savedTestCases.length === 0}
            title="Save formula as new entry"
            aria-label="Save formula as new entry"
          >
            <span className="save-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" focusable="false" role="img">
                <path
                  d="M4.75 2.5h8.69c.2 0 .39.08.53.22l3.31 3.31c.14.14.22.33.22.53v10.72c0 .83-.67 1.5-1.5 1.5H4.75c-.83 0-1.5-.67-1.5-1.5V4c0-.83.67-1.5 1.5-1.5Zm5.5 2.25H5.88c-.2 0-.38.16-.38.38v3.25c0 .21.17.37.38.37h4.37c.2 0 .37-.16.37-.37V5.13c0-.22-.17-.38-.37-.38Zm3.5 0H13c-.21 0-.38.17-.38.38v3.25c0 .21.17.37.38.37h.75c.41 0 .75-.34.75-.75V4.75c0-.41-.34-.75-.75-.75Zm-6.5 7.5c-.62 0-1.13.5-1.13 1.12v3.01c0 .62.51 1.12 1.13 1.12h4.5c.62 0 1.12-.5 1.12-1.12v-3c0-.63-.5-1.13-1.12-1.13h-4.5Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span>Save As</span>
          </button>
          <button
            type="button"
            className="header-icon-button"
            onClick={handleDuplicateFormula}
            disabled={!selectedFormulaId}
            title="Duplicate formula"
            aria-label="Duplicate formula"
          >
            ⧉
          </button>
          <button
            type="button"
            className="header-icon-button"
            onClick={handleRenameFormula}
            disabled={!selectedFormulaId}
            title="Rename formula"
            aria-label="Rename formula"
          >
            ✎
          </button>
          <button
            type="button"
            className="header-icon-button danger"
            onClick={handleDeleteFormula}
            disabled={!selectedFormulaId}
            title="Delete formula"
            aria-label="Delete formula"
          >
            🗑
          </button>
        </div>
      </header>
      <div className="tester-wrapper">
        <aside className={`testcase-drawer-shell ${isTestCaseDrawerOpen ? 'open' : 'closed'}`}>
          <div
            className={`testcase-drawer ${isTestCaseDrawerOpen ? 'open' : 'closed'}`}
            aria-expanded={isTestCaseDrawerOpen}
          >
            <div
              className="testcase-panel"
              id="testcase-panel"
              aria-hidden={!isTestCaseDrawerOpen}
            >
              <div className="testcase-panel__header">
                <h2>Saved Variables</h2>
                <p>Store and switch between variable sets for this formula.</p>
              </div>
              <div className="testcase-panel__controls">
                <div className="testcase-list-header">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleCreateTestCase}
                    title="Save variables"
                    aria-label="Save variables"
                  >
                    ＋ Save variables
                  </button>
                </div>
                <ul className="testcase-list" role="list">
                  {savedTestCases.length === 0 ? (
                    <li className="testcase-list__empty">No saved variables yet.</li>
                  ) : (
                    savedTestCases.map((testCase) => {
                      const isSelected = testCase.id === selectedTestCaseId;
                      const variableCount = testCase.variables.length;
                      const variableLabel =
                        variableCount === 1 ? '1 variable' : `${variableCount} variables`;
                      const canDelete = savedTestCases.length > 1;
                      return (
                        <li
                          key={testCase.id}
                          className={`testcase-list__item ${isSelected ? 'is-selected' : ''}`}
                        >
                          <button
                            type="button"
                            className="testcase-item__body"
                            onClick={() => handleSelectTestCase(testCase.id)}
                          >
                            <span className="testcase-item__name">{testCase.name}</span>
                            <span className="testcase-item__meta">{variableLabel}</span>
                          </button>
                          <div className="testcase-item__actions">
                            <button
                              type="button"
                              className="testcase-item__menu-trigger"
                              aria-haspopup="menu"
                              aria-expanded={openContextMenuId === testCase.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenContextMenuId((previous) =>
                                  previous === testCase.id ? null : testCase.id
                                );
                              }}
                            >
                              ⋮
                            </button>
                            {openContextMenuId === testCase.id ? (
                              <div className="testcase-item__menu" role="menu">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDuplicateTestCase(testCase.id);
                                  }}
                                >
                                  Duplicate
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleRenameTestCase(testCase.id);
                                  }}
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  disabled={!canDelete}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeleteTestCase(testCase.id);
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>
          </div>
        </aside>
        <div className="testcase-toggle-rail">
          <button
            type="button"
            className="testcase-drawer__toggle"
            onClick={() => {
              setIsTestCaseDrawerOpen((previous) => !previous);
              setOpenContextMenuId(null);
            }}
            aria-label={isTestCaseDrawerOpen ? 'Hide test cases' : 'Show test cases'}
          >
            <span aria-hidden="true">
              {isTestCaseDrawerOpen ? 'Hide Saved Variables' : 'Saved Variables'}
            </span>
            <span className="sr-only">
              {isTestCaseDrawerOpen ? 'Hide saved variables' : 'Show saved variables'}
            </span>
          </button>
        </div>
        <div className="tester-shell">
          <div className="tester-shell__body">
            {editorError ? (
              <div className="tester-error-banner" role="alert">
                <div className="tester-error-banner__title">Syntax error</div>
                <pre className="tester-error-banner__message">{editorError}</pre>
              </div>
            ) : null}
            {evaluationError ? (
              <div className="tester-error-banner" role="alert">
                <div className="tester-error-banner__title">
                  Evaluation error at '{expression.trim().length > 0 ? expression : 'expression'}'
                </div>
                <pre className="tester-error-banner__message">{evaluationError}</pre>
              </div>
            ) : null}
            <div className="tester-shell__editor">
              <FuncScriptTester
                key={testerComponentKey}
                value={expression}
                onChange={handleExpressionChange}
                saveKey={testerSaveKey}
                variables={testerVariablesPayload}
                onVariablesChange={handleVariablesChange}
                onError={setEditorError}
                onEvaluationError={setEvaluationError}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
