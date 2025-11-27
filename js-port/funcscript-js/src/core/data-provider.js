const { assertTyped } = require('./value');

class FsDataProvider {
  constructor(parent = null) {
    this.parent = parent;
  }

  get(name) {
    if (this.parent) {
      return this.parent.get(name);
    }
    return null;
  }

  isDefined(name) {
    if (this.parent) {
      return this.parent.isDefined(name);
    }
    return false;
  }
}

class MapDataProvider extends FsDataProvider {
  constructor(map = {}, parent = null) {
    super(parent);
    this.map = {};
    for (const [key, value] of Object.entries(map)) {
      this.map[key.toLowerCase()] = assertTyped(value, 'MapDataProvider entries must be typed');
    }
  }

  set(name, value) {
    this.map[name.toLowerCase()] = assertTyped(value, 'MapDataProvider entries must be typed');
  }

  get(name) {
    const key = name.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(this.map, key)) {
      return this.map[key];
    }
    return super.get(name);
  }

  isDefined(name) {
    const key = name.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(this.map, key)) {
      return true;
    }
    return super.isDefined(name);
  }
}

class KvcProvider extends FsDataProvider {
  constructor(kvc, parent) {
    super(parent);
    this.kvc = kvc;
  }

  get(name) {
    const key = name.toLowerCase();
    if (this.kvc.isDefined(key)) {
      return this.kvc.get(key);
    }
    return super.get(name);
  }

  isDefined(name) {
    const key = name.toLowerCase();
    if (this.kvc.isDefined(key)) {
      return true;
    }
    return super.isDefined(name);
  }
}

module.exports = {
  FsDataProvider,
  MapDataProvider,
  KvcProvider
};
