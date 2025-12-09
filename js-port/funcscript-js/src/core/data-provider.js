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

  isDefined(name, hierarchy = true) {
    if (this.parent && hierarchy !== false) {
      return this.parent.isDefined(name, hierarchy);
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

  isDefined(name, hierarchy = true) {
    const key = name.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(this.map, key)) {
      return true;
    }
    if (hierarchy === false) {
      return false;
    }
    return super.isDefined(name, hierarchy);
  }
}

class KvcProvider extends FsDataProvider {
  constructor(kvc, parent) {
    super(parent);
    this.kvc = kvc;
  }

  get(name) {
    const key = name.toLowerCase();
    if (this.kvc.isDefined(key, true)) {
      return this.kvc.get(key);
    }
    return super.get(name);
  }

  isDefined(name, hierarchy = true) {
    const key = name.toLowerCase();
    if (this.kvc.isDefined(key, hierarchy)) {
      return true;
    }
    if (hierarchy === false) {
      return false;
    }
    return super.isDefined(name, hierarchy);
  }
}

module.exports = {
  FsDataProvider,
  MapDataProvider,
  KvcProvider
};
