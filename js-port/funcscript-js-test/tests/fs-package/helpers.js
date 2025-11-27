'use strict';

function createMockResolver(root, imports = {}) {
  const resolveNode = (segments = []) => {
    const pathSegments = Array.isArray(segments) ? segments : [];
    let current = root;
    for (const segment of pathSegments) {
      if (!current || !current.children) {
        return null;
      }
      current = current.children[segment];
      if (!current) {
        return null;
      }
    }
    return current || null;
  };

  return {
    listChildren(path) {
      const node = resolveNode(path);
      if (!node || !node.children) {
        return [];
      }
      return Object.keys(node.children);
    },
    getExpression(path) {
      const node = resolveNode(path);
      return node ? node.expression ?? null : null;
    },
    package(name) {
      return imports[name] || null;
    }
  };
}

function jsBlock(strings, ...values) {
  let result = '';
  for (let i = 0; i < strings.length; i += 1) {
    result += strings[i];
    if (i < values.length) {
      result += values[i];
    }
  }
  const trimmed = result.replace(/^\s*\n/, '').replace(/\s*$/, '');
  return '```javascript\n' + trimmed + '\n```';
}

module.exports = {
  createMockResolver,
  jsBlock
};
