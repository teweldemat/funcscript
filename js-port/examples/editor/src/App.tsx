import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Container,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { ThemeProvider } from '@mui/material/styles';
import { FuncScriptEditor } from '@tewelde/funcscript-editor';
import { Engine } from '@tewelde/funcscript/browser';
import { theme } from './theme';

const defaultExpression = 'gross * (1 - rate)';

type VariableDefinition = {
  name: string;
  expression: string;
};

const isValidIdentifier = (name: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);

function App(): JSX.Element {
  const [expression, setExpression] = useState(defaultExpression);
  const [parseError, setParseError] = useState<string | null>(null);
  const [variables, setVariables] = useState<VariableDefinition[]>([
    { name: 'gross', expression: '5200' },
    { name: 'rate', expression: '0.13' }
  ]);
  const [newVariableName, setNewVariableName] = useState('');
  const [variableError, setVariableError] = useState<string | null>(null);
  const [renameState, setRenameState] = useState<{
    index: number;
    value: string;
    error: string | null;
  } | null>(null);

  const normalizedNames = useMemo(
    () => variables.map((variable) => variable.name.trim().toLowerCase()),
    [variables]
  );

  const nameExists = useCallback(
    (candidate: string, skipIndex?: number) => {
      const normalized = candidate.trim().toLowerCase();
      return normalized.length > 0
        ? normalizedNames.some((value, index) => value === normalized && index !== skipIndex)
        : false;
    },
    [normalizedNames]
  );

  const [evaluationState, setEvaluationState] = useState<{
    value: string | null;
    type: string | null;
    error: string | null;
  }>({ value: null, type: null, error: null });
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handleAddVariable = () => {
    const trimmed = newVariableName.trim();
    if (trimmed.length === 0) {
      setVariableError('Variable name is required.');
      return;
    }
    if (!isValidIdentifier(trimmed)) {
      setVariableError('Use letters, digits, or underscores (no leading digit).');
      return;
    }
    if (nameExists(trimmed)) {
      setVariableError('That name is already in use.');
      return;
    }
    setVariables((prev) => [...prev, { name: trimmed, expression: '' }]);
    setNewVariableName('');
    setVariableError(null);
  };

  const handleDeleteVariable = (index: number) => {
    setVariables((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleOpenRenameDialog = (index: number) => {
    setRenameState({ index, value: variables[index].name, error: null });
  };

  const closeRenameDialog = () => setRenameState(null);

  const handleRenameInputChange = (value: string) => {
    setRenameState((current) => (current ? { ...current, value, error: null } : current));
  };

  const handleRenameConfirm = () => {
    if (!renameState) {
      return;
    }
    const trimmed = renameState.value.trim();
    if (trimmed.length === 0) {
      setRenameState({ ...renameState, error: 'Variable name is required.' });
      return;
    }
    if (!isValidIdentifier(trimmed)) {
      setRenameState({ ...renameState, error: 'Use letters, digits, or underscores (no leading digit).' });
      return;
    }
    if (nameExists(trimmed, renameState.index)) {
      setRenameState({ ...renameState, error: 'That name is already in use.' });
      return;
    }
    setVariables((prev) =>
      prev.map((variable, idx) => (idx === renameState.index ? { ...variable, name: trimmed } : variable))
    );
    setRenameState(null);
  };

  const formatKeyName = useCallback((rawName: string, fallbackIndex: number) => {
    const trimmed = rawName.trim();
    if (isValidIdentifier(trimmed)) {
      return trimmed;
    }
    return `_var${fallbackIndex + 1}`;
  }, []);

  const toPlainValue = useCallback((typed: unknown): unknown => {
    if (!typed) {
      return typed;
    }
    const fsType = Engine.typeOf(typed as any);
    const raw = Engine.valueOf(typed as any) as any;
    switch (fsType) {
      case Engine.FSDataType.List: {
        if (raw && typeof raw.toArray === 'function') {
          return raw.toArray().map((item: unknown) => toPlainValue(item));
        }
        if (Array.isArray(raw)) {
          return raw.map((item) => toPlainValue(item));
        }
        return raw;
      }
      case Engine.FSDataType.KeyValueCollection: {
        if (!raw || typeof raw.getAll !== 'function') {
          return raw;
        }
        const obj: Record<string, unknown> = {};
        for (const [key, value] of raw.getAll()) {
          obj[key] = toPlainValue(value);
        }
        return obj;
      }
      case Engine.FSDataType.Error: {
        return raw?.errorMessage ?? raw ?? 'Error';
      }
      default:
        return raw;
    }
  }, []);

  const formatPlainValue = useCallback((value: unknown): string => {
    if (value === null) {
      return 'null';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, []);

  const handleVariableExpressionChange = (index: number, value: string) => {
    setVariables((prev) => prev.map((variable, idx) => (idx === index ? { ...variable, expression: value } : variable)));
  };

  useEffect(() => {
    let cancelled = false;
    setIsEvaluating(true);
    setEvaluationState((prev) => ({ ...prev, error: null }));
    try {
      const targetExpression = expression.trim().length > 0 ? expression : 'null';
      const provider = new Engine.DefaultFsDataProvider();

      variables.forEach((variable, index) => {
        const key = formatKeyName(variable.name, index).toLowerCase();
        const expr = variable.expression.trim().length > 0 ? variable.expression : 'null';
        const value = Engine.evaluate(expr, provider);
        provider.set(key, value);
      });

      const typed = Engine.evaluate(targetExpression, provider);
      const typeName = Engine.getTypeName(Engine.typeOf(typed));
      const plain = toPlainValue(typed);
      if (!cancelled) {
        setEvaluationState({ value: formatPlainValue(plain), type: typeName, error: null });
      }
    } catch (error) {
      if (!cancelled) {
        const message = error instanceof Error ? error.message : String(error);
        setEvaluationState({ value: null, type: null, error: message });
      }
    } finally {
      if (!cancelled) {
        setIsEvaluating(false);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [expression, variables, formatKeyName, formatPlainValue, toPlainValue]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" color="primary" enableColorOnDark>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            FuncScript Syntax Highlighting
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{ py: 4 }}>
        <Container maxWidth="lg">
          <Stack spacing={4}>
            <Paper elevation={4} sx={{ p: 3 }}>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="h4" component="h1" gutterBottom>
                    Interactive Playground
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', lg: 'row' },
                    gap: 3
                  }}
                >
                  <Stack spacing={2} sx={{ flex: { xs: '1 1 auto', lg: '3 1 0' } }}>
                    <Typography variant="body1" color="text.secondary">
                      Start typing to explore FuncScript syntax with parser-backed highlighting.
                    </Typography>
                    <Box
                      sx={{
                        height: { xs: 360, md: 480 },
                        display: 'flex'
                      }}
                    >
                      <FuncScriptEditor
                        value={expression}
                        onChange={setExpression}
                        onError={setParseError}
                        minHeight={320}
                        style={{ width: '100%', height: '100%' }}
                      />
                    </Box>
                    {parseError ? (
                      <Alert severity="error" variant="outlined">
                        {parseError}
                      </Alert>
                    ) : (
                      <Alert severity="info" variant="outlined">
                        Evaluations update automatically as you edit the expression or variable bindings.
                      </Alert>
                    )}
                  </Stack>
                  <Stack spacing={3} sx={{ flex: { xs: '1 1 auto', lg: '2 1 0' } }}>
                    <Paper variant='outlined' sx={{ p: 2 }}>
                      <Typography variant='h5' gutterBottom>
                        Result {evaluationState.type ? `(type: ${evaluationState.type})` : ''}
                      </Typography>
                      <Typography variant='body2' color='text.secondary' gutterBottom>
                        {isEvaluating
                          ? 'Evaluating...'
                          : 'Evaluation runs inside a temporary block using the variables below.'}
                      </Typography>
                      {evaluationState.error ? (
                        <Alert severity='error' variant='outlined'>
                          {evaluationState.error}
                        </Alert>
                      ) : (
                        <Box component='pre' sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {evaluationState.value ?? 'No evaluation yet.'}
                        </Box>
                      )}
                    </Paper>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="h5" component="h2" gutterBottom>
                          Variables
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Create, rename, or delete variables. Each entry becomes a binding the expression can
                          reference.
                        </Typography>
                      </Box>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={2}
                        alignItems={{ xs: 'stretch', sm: 'flex-end' }}
                      >
                        <TextField
                          label="New variable name"
                          value={newVariableName}
                          onChange={(event) => {
                            setNewVariableName(event.target.value);
                            if (variableError) {
                              setVariableError(null);
                            }
                          }}
                          error={Boolean(variableError)}
                          helperText={
                            variableError ?? 'Use letters, digits, or underscores (no leading digit).'
                          }
                          fullWidth
                        />
                        <Button
                          variant='contained'
                          startIcon={<AddIcon />}
                          onClick={handleAddVariable}
                          sx={{ minWidth: { sm: 180 } }}
                        >
                          Add variable
                        </Button>
                      </Stack>
                      <Paper variant='outlined'>
                        <List disablePadding>
                          {variables.length === 0 ? (
                            <ListItem>
                              <Typography>No variables yet. Add one above to get started.</Typography>
                            </ListItem>
                          ) : (
                            variables.map((variable, index) => (
                              <ListItem key={`${variable.name || 'var'}-${index}`} divider alignItems='flex-start'>
                                <Box sx={{ flexGrow: 1, pr: 2 }}>
                                  <Typography variant='subtitle1'>
                                    {variable.name || `Variable ${index + 1}`}
                                  </Typography>
                                  <TextField
                                    label='Expression'
                                    value={variable.expression}
                                    onChange={(event) =>
                                      handleVariableExpressionChange(index, event.target.value)
                                    }
                                    placeholder='Enter FuncScript expression'
                                    fullWidth
                                    margin='dense'
                                    multiline
                                  />
                                </Box>
                                <Stack direction='row' spacing={1} sx={{ pt: 1 }}>
                                  <IconButton
                                    edge='end'
                                    aria-label={`Rename ${variable.name || 'variable'}`}
                                    onClick={() => handleOpenRenameDialog(index)}
                                  >
                                    <EditIcon />
                                  </IconButton>
                                  <IconButton
                                    edge='end'
                                    aria-label={`Delete ${variable.name || 'variable'}`}
                                    onClick={() => handleDeleteVariable(index)}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Stack>
                              </ListItem>
                            ))
                          )}
                        </List>
                      </Paper>
                    </Stack>
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Container>
      </Box>
      <Dialog open={Boolean(renameState)} onClose={closeRenameDialog} fullWidth maxWidth='xs'>
        <DialogTitle>Rename variable</DialogTitle>
        <DialogContent>
                    <TextField
                      autoFocus
                      margin='dense'
                      label='Variable name'
                      value={renameState?.value ?? ''}
                      onChange={(event) => handleRenameInputChange(event.target.value)}
                      error={Boolean(renameState?.error)}
                      helperText={
                        renameState?.error ?? 'Use letters, digits, or underscores (no leading digit).'
                      }
                      fullWidth
                    />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRenameDialog}>Cancel</Button>
          <Button variant='contained' onClick={handleRenameConfirm} startIcon={<EditIcon />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

export default App;
