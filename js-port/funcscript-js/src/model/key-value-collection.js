const { FsDataProvider } = require('../core/data-provider');
const { assertTyped, typeOf, valueOf, makeValue } = require('../core/value');
const { FSDataType } = require('../core/fstypes');

class KeyValueCollection extends FsDataProvider {
  constructor(parent = null) {
    super(parent);
    this.__fsKind = 'KeyValueCollection';
  }

  get(key) {
    throw new Error('KeyValueCollection.get not implemented');
  }

  isDefined(key) {
    throw new Error('KeyValueCollection.isDefined not implemented');
  }

  getAll() {
    throw new Error('KeyValueCollection.getAll not implemented');
  }

  static merge(col1, col2) {
    if (!col1 && !col2) {
      return null;
    }
    if (!col1) {
      return col2;
    }
    if (!col2) {
      return col1;
    }
    const merged = [];
    const seen = new Map();

    const pushEntries = (entries) => {
      for (const [key, value] of entries) {
        const lower = key.toLowerCase();
        const incomingTyped = assertTyped(value);
        if (!seen.has(lower)) {
          merged.push([key, incomingTyped]);
          seen.set(lower, merged.length - 1);
        } else {
          const index = seen.get(lower);
          const existing = merged[index][1];
          const existingType = typeOf(existing);
          const incomingType = typeOf(incomingTyped);
          if (existingType === FSDataType.KeyValueCollection && incomingType === FSDataType.KeyValueCollection) {
            const mergedValue = KeyValueCollection.merge(valueOf(existing), valueOf(incomingTyped));
            merged[index][1] = makeValue(FSDataType.KeyValueCollection, mergedValue);
          } else {
            merged[index][1] = incomingTyped;
          }
        }
      }
    };

    pushEntries(col1.getAll());
    pushEntries(col2.getAll());

    if (col1.parent !== col2.parent) {
      throw new Error('Key-value collections from different contexts cannot be merged');
    }

    return new SimpleKeyValueCollection(col1.parent, merged);
  }
}

class SimpleKeyValueCollection extends KeyValueCollection {
  constructor(parentOrEntries, entriesMaybe) {
    let parent = null;
    let entries = [];
    if (entriesMaybe !== undefined) {
      parent = parentOrEntries || null;
      entries = entriesMaybe || [];
    } else if (Array.isArray(parentOrEntries)) {
      entries = parentOrEntries;
    } else {
      parent = parentOrEntries || null;
      entries = [];
    }
    super(parent);
    this._data = [];
    this._index = new Map();
    this._applyEntries(entries);
  }

  _applyEntries(entries) {
    this._data = [];
    this._index = new Map();
    for (const [key, rawValue] of entries) {
      const lower = key.toLowerCase();
      if (this._index.has(lower)) {
        throw new Error(`Duplicate key '${key}' in key-value collection`);
      }
      const typed = assertTyped(rawValue);
      this._data.push([key, typed]);
      this._index.set(lower, typed);
    }
  }

  get(key) {
    const lower = key.toLowerCase();
    if (this._index.has(lower)) {
      return this._index.get(lower);
    }
    return this.parent ? this.parent.get(key) : null;
  }

  isDefined(key) {
    const lower = key.toLowerCase();
    if (this._index.has(lower)) {
      return true;
    }
    return this.parent ? this.parent.isDefined(key) : false;
  }

  getAll() {
    return this._data.slice();
  }
}

module.exports = {
  KeyValueCollection,
  SimpleKeyValueCollection
};
