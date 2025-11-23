import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorView } from '@codemirror/view';
import FuncScriptTester, { type FuncScriptTesterVariableInput } from '../FuncScriptTester.js';

type TesterHarnessProps = {
  initialValue?: string;
  saveKey?: string;
  mode?: 'standard' | 'tree';
};

const TesterHarness = ({ initialValue = 'sin(x)', saveKey, mode = 'standard' }: TesterHarnessProps) => {
  const [value, setValue] = useState(initialValue);
  return (
    <FuncScriptTester
      value={value}
      onChange={setValue}
      minHeight={160}
      style={{ height: 240 }}
      saveKey={saveKey}
      initialMode={mode}
    />
  );
};

type VariablesHarnessProps = {
  initialVariables: FuncScriptTesterVariableInput[];
};

const VariablesHarness = ({ initialVariables }: VariablesHarnessProps) => {
  const [value, setValue] = useState('foo');
  const [variables, setVariables] = useState<FuncScriptTesterVariableInput[]>(() => initialVariables);
  return (
    <FuncScriptTester
      value={value}
      onChange={setValue}
      minHeight={160}
      style={{ height: 240 }}
      variables={variables}
      onVariablesChange={setVariables}
    />
  );
};

const getEditorViewFromContainer = (container: HTMLElement | null) => {
  if (!container) {
    return null;
  }
  const editorElement = container.querySelector('.cm-editor');
  return editorElement ? EditorView.findFromDOM(editorElement as HTMLElement) : null;
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('FuncScriptTester tree workflow', () => {
  it('collapses parse tree nodes by default', async () => {
    const user = userEvent.setup();
    render(<TesterHarness mode="tree" />);

    const treeEditor = await screen.findByTestId('tester-tree-editor');
    expect(within(treeEditor).queryByRole('button', { name: /^x$/ })).toBeNull();

    const expandToggle = await within(treeEditor).findByRole('button', {
      name: /^Expand node sin\(x\)$/
    });
    await user.click(expandToggle);

    await within(treeEditor).findByRole('button', { name: /^x$/ });
  });

  it('applies node edits back to the full expression', async () => {
    const user = userEvent.setup();
    const { container } = render(<TesterHarness mode="tree" />);

    const treeEditor = await screen.findByTestId('tester-tree-editor');

    const expandToggle = await within(treeEditor).findByRole('button', {
      name: /^Expand node sin\(x\)$/
    });
    await user.click(expandToggle);

    const nodeButton = await within(treeEditor).findByRole('button', { name: /^x$/ });
    await user.click(nodeButton);

    const getNodeEditor = () => {
      const editors = within(treeEditor).getAllByRole('textbox');
      expect(editors.length).toBeGreaterThan(0);
      return editors[editors.length - 1] as HTMLElement;
    };

    const nodeEditorDom = getNodeEditor();
    await user.click(nodeEditorDom);

    const nodeEditorView = EditorView.findFromDOM(nodeEditorDom);
    expect(nodeEditorView).not.toBeNull();

    nodeEditorView!.dispatch({
      changes: {
        from: 0,
        to: nodeEditorView!.state.doc.length,
        insert: 'abc'
      }
    });

    await waitFor(() => {
      const view = EditorView.findFromDOM(getNodeEditor());
      expect(view).not.toBeNull();
      expect(view!.state.doc.toString()).toBe('abc');
    });

    fireEvent.blur(nodeEditorDom);

    const standardWrapper = screen.getByTestId('tester-standard-editor');
    await waitFor(() => {
      const standardView = getEditorViewFromContainer(standardWrapper);
      expect(standardView).not.toBeNull();
      expect(standardView!.state.doc.toString()).toBe('sin(abc)');
    });

    const previewContainer = treeEditor.querySelector('[style*="white-space: pre-wrap"]');
    expect(previewContainer).not.toBeNull();
    const selectionSpan = await within(previewContainer as HTMLElement).findByText('abc');
    expect(selectionSpan).toHaveStyle({ textDecoration: 'underline' });
  });

  it('clears node syntax errors after successful apply', async () => {
    const user = userEvent.setup();
    render(<TesterHarness initialValue="sin(abc)" mode="tree" />);

    const treeEditor = await screen.findByTestId('tester-tree-editor');
    const expandToggle = await within(treeEditor).findByRole('button', {
      name: /^Expand node sin\(abc\)$/
    });
    await user.click(expandToggle);
    const nodeButton = await within(treeEditor).findByRole('button', { name: /^abc$/ });
    await user.click(nodeButton);

    const getNodeEditor = () => {
      const editors = within(treeEditor).getAllByRole('textbox');
      expect(editors.length).toBeGreaterThan(0);
      return editors[editors.length - 1] as HTMLElement;
    };

    const nodeEditorView = EditorView.findFromDOM(getNodeEditor());
    expect(nodeEditorView).not.toBeNull();

    nodeEditorView!.dispatch({
      changes: {
        from: 0,
        to: nodeEditorView!.state.doc.length,
        insert: 'x'
      }
    });

    await waitFor(() => {
      const view = EditorView.findFromDOM(getNodeEditor());
      expect(view).not.toBeNull();
      expect(view!.state.doc.toString()).toBe('x');
    });

    expect(screen.queryByTestId('tree-node-error')).toBeNull();

    fireEvent.blur(getNodeEditor());

    await within(treeEditor).findByRole('button', { name: /^sin\(x\)$/ });

    await waitFor(() => {
      expect(screen.queryByTestId('tree-node-error')).toBeNull();
    });
  });

  it('supports collapsing and expanding tree nodes', async () => {
    const user = userEvent.setup();
    render(<TesterHarness mode="tree" />);

    const treeEditor = await screen.findByTestId('tester-tree-editor');
    expect(within(treeEditor).queryByRole('button', { name: /^x$/ })).toBeNull();

    const expandToggle = await within(treeEditor).findByRole('button', {
      name: /^Expand node sin\(x\)$/
    });
    await user.click(expandToggle);

    await within(treeEditor).findByRole('button', { name: /^x$/ });

    const collapseToggle = await within(treeEditor).findByRole('button', {
      name: /^Collapse node sin\(x\)$/
    });
    await user.click(collapseToggle);

    await waitFor(() => {
      expect(within(treeEditor).queryByRole('button', { name: /^x$/ })).toBeNull();
    });

    const expandAgain = await within(treeEditor).findByRole('button', {
      name: /^Expand node sin\(x\)$/
    });
    await user.click(expandAgain);

    await within(treeEditor).findByRole('button', { name: /^x$/ });
  });

  it('persists tree state when saveKey is provided', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TesterHarness saveKey="persist-test" mode="tree" />);

    const treeEditor = await screen.findByTestId('tester-tree-editor');
    expect(within(treeEditor).queryByRole('button', { name: /^x$/ })).toBeNull();

    const expandToggle = await within(treeEditor).findByRole('button', {
      name: /^Expand node sin\(x\)$/
    });
    await user.click(expandToggle);

    await within(treeEditor).findByRole('button', { name: /^x$/ });

    const collapseToggle = await within(treeEditor).findByRole('button', {
      name: /^Collapse node sin\(x\)$/
    });
    await user.click(collapseToggle);

    await waitFor(() => {
      expect(within(treeEditor).queryByRole('button', { name: /^x$/ })).toBeNull();
    });

    const testToggle = screen.getAllByRole('button', { name: 'Test' })[0];
    await user.click(testToggle);

    unmount();

    render(<TesterHarness saveKey="persist-test" mode="tree" />);

    await screen.findByTestId('tester-tree-editor');
    expect(screen.queryByRole('button', { name: /^x$/ })).toBeNull();
    const toggles = screen.getAllByRole('button', { name: 'Test' });
    expect(toggles[0]).toHaveAttribute('aria-pressed', 'true');

    const expandAfterReload = await screen.findByRole('button', {
      name: /^Expand node sin\(x\)$/
    });
    await user.click(expandAfterReload);

    await screen.findByRole('button', { name: /^x$/ });
  });

  it('keeps the current node selected when a syntax error is present', async () => {
    const user = userEvent.setup();
    render(<TesterHarness mode="tree" />);

    const treeEditor = await screen.findByTestId('tester-tree-editor');
    const expandToggle = await within(treeEditor).findByRole('button', {
      name: /^Expand node sin\(x\)$/
    });
    await user.click(expandToggle);
    const identifierButton = await within(treeEditor).findByRole('button', { name: /^x$/ });
    await user.click(identifierButton);

    const getNodeEditor = () => {
      const editors = within(treeEditor).getAllByRole('textbox');
      expect(editors.length).toBeGreaterThan(0);
      return editors[editors.length - 1] as HTMLElement;
    };

    const nodeEditorDom = getNodeEditor();
    await user.click(nodeEditorDom);
    const nodeEditorView = EditorView.findFromDOM(nodeEditorDom);
    expect(nodeEditorView).not.toBeNull();

    nodeEditorView!.dispatch({
      changes: {
        from: 0,
        to: nodeEditorView!.state.doc.length,
        insert: '('
      }
    });

    await screen.findByTestId('tree-node-error');

    const rootButton = await within(treeEditor).findByRole('button', { name: /^sin\(x\)$/ });
    await user.click(rootButton);

    const latestView = EditorView.findFromDOM(getNodeEditor());
    expect(latestView).not.toBeNull();
    expect(latestView!.state.doc.toString()).toBe('(');
    expect(screen.getByTestId('tree-node-error')).toBeInTheDocument();
  });

  it('hides testing controls by default and toggles visibility', async () => {
    const user = userEvent.setup();
    render(<TesterHarness />);

    expect(screen.queryByText('Variables will appear here when referenced.')).toBeNull();

    const testToggle = screen.getAllByRole('button', { name: 'Test' })[0];
    await user.click(testToggle);
    expect(await screen.findByText('Variables will appear here when referenced.')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Test' })[0]);
    await waitFor(() => {
      expect(screen.queryByText('Variables will appear here when referenced.')).toBeNull();
    });
  });
});

describe('FuncScriptTester variable controls', () => {
  it('clears all variables via toolbar control', async () => {
    const user = userEvent.setup();
    render(
      <VariablesHarness
        initialVariables={[
          { name: 'alpha', expression: '1' },
          { name: 'beta', expression: '2' }
        ]}
      />
    );

    await user.click(screen.getAllByRole('button', { name: 'Test' })[0]);

    const clearButton = await screen.findByRole('button', { name: 'Clear variables' });
    expect(clearButton).not.toBeDisabled();

    await screen.findByText('alpha');
    await screen.findByText('beta');

    await user.click(clearButton);

    await waitFor(() => {
      expect(clearButton).toBeDisabled();
    });

    await screen.findByText('Variables will appear here when referenced.');
  });

  it('removes individual variables from the list', async () => {
    const user = userEvent.setup();
    render(
      <VariablesHarness
        initialVariables={[
          { name: 'alpha', expression: '1' },
          { name: 'beta', expression: '2' }
        ]}
      />
    );

    await user.click(screen.getAllByRole('button', { name: 'Test' })[0]);

    const deleteBeta = await screen.findByRole('button', { name: 'Delete variable beta' });
    await user.click(deleteBeta);

    await waitFor(() => {
      expect(screen.queryByText('beta')).toBeNull();
    });

    expect(screen.getByText('alpha')).toBeInTheDocument();
  });

  it('adds a variable manually', async () => {
    const user = userEvent.setup();
    render(<VariablesHarness initialVariables={[]} />);

    await user.click(screen.getAllByRole('button', { name: 'Test' })[0]);

    const nameInput = await screen.findByLabelText('Variable name');
    await user.type(nameInput, 'gamma');

    const addButton = screen.getByRole('button', { name: 'Add variable' });
    await user.click(addButton);

    await screen.findByText('gamma');
    const gammaEntry = screen.getByText('gamma').closest('[role="button"]');
    expect(gammaEntry).not.toBeNull();
    expect(gammaEntry).toHaveAttribute('aria-pressed', 'true');
  });

  it('refuses duplicate manual variable names', async () => {
    const user = userEvent.setup();
    render(
      <VariablesHarness
        initialVariables={[
          { name: 'alpha', expression: '1' }
        ]}
      />
    );

    await user.click(screen.getAllByRole('button', { name: 'Test' })[0]);

    const nameInput = await screen.findByLabelText('Variable name');
    await user.type(nameInput, 'ALPHA');

    const addButton = screen.getByRole('button', { name: 'Add variable' });
    await user.click(addButton);

    await screen.findByText('Variable already exists.');

    const alphaLabel = await screen.findByText('alpha');
    const alphaEntry = alphaLabel.closest('[role="button"]');
    expect(alphaEntry).not.toBeNull();
    expect(alphaEntry).toHaveAttribute('aria-pressed', 'true');
  });
});
