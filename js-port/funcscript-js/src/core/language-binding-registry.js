const bindings = new Map();

function normalizeIdentifier(identifier) {
  if (typeof identifier !== 'string') {
    return '';
  }
  return identifier.trim().toLowerCase();
}

function registerLanguageBinding(identifier, binding) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) {
    throw new Error('Language identifier is required.');
  }
  if (!binding || typeof binding.compile !== 'function' || typeof binding.evaluate !== 'function') {
    throw new Error(`Language binding for '${identifier}' must implement compile and evaluate.`);
  }

  bindings.set(normalized, binding);
}

function tryGetLanguageBinding(identifier) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) {
    return null;
  }
  return bindings.get(normalized) || null;
}

function clearLanguageBindings() {
  bindings.clear();
}

module.exports = {
  registerLanguageBinding,
  tryGetLanguageBinding,
  clearLanguageBindings
};
