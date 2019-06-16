const fs = require('fs-extra');
const { EventBus } = require('../utils/utils');

class Dep {
  constructor(id, events) {
    this.id = id;
    this.activity = false;
    this.deps = new Set();
    this.subs = new Set();
    this.eventBus = new EventBus(events);
  }

  updateDeps(deps) { // public
    if (!this.activity) {
      return;
    }
    const oldDeps = new Set(this.deps);
    for (let i = 0, l = deps.length; i < l; i++) {
      const dep = deps[i];
      this.deps.has(dep) ? oldDeps.delete(dep) : this.addDep(dep);
    }
    for (const dep of oldDeps) {
      this.removeDep(dep);
    }
  }

  addDep(dep) { // private
    this.deps.add(dep);
    dep.subs.add(this);
    dep.updateState(true);
  }

  removeDep(dep) { // private
    this.deps.delete(dep);
    dep.subs.delete(this);
    dep.updateState(false);
  }

  updateState(isActive) { // private
    if (isActive === this.activity) {
      return;
    }
    let state = this.activity;
    if (state) {
      let count = 0;
      for (const sub of this.subs) {
        !sub.activity && count++;
      }
      if (count === this.subs.size) {
        state = !state;
      }
    } else {
      for (const sub of this.subs) {
        if (sub.activity) {
          state = !state;
          break;
        }
      }
    }
    if (state !== this.activity) {
      state ? this.active() : this.disable();
      for (const dep of this.deps) {
        dep.updateState(isActive);
      }
    }
  }

  active() { // private
    this.activity = true;
  }

  disable() { // private
    this.activity = false;
  }

  destory() {
    this.updateDeps([]);
  }
};

class FileDep extends Dep {
  constructor(file) {
    super(file, ['update']);
    this.exists = false;
  }

  init() {
    if (!this.exists) {
      this.active();
      this.exists = fs.existsSync(this.id);
      return this.exists;
    }
  }

  update(isRoot = false) { // public
    this.eventBus.emit('update', this, isRoot);
    for (const sub of this.subs) {
      sub.update();
    }
  }

  add() { // public
    this.exists = true;
    this.updateState(true);
    this.update();
  }

  remove() { // public
    this.exists = false;
    this.updateState(false);
    for (const sub of this.subs) {
      sub.update();
    }
    this.destory();
  }
}

const RoleConfig = {
  app: {
    base: 'json',
    types: ['js', 'css', 'json'],
  },
  template: {
    types: ['css', 'xml'],
  },
};

class EntryDep extends Dep {
  constructor(id, role) {
    const types = (RoleConfig[role] && RoleConfig[role].types) || ['js', 'css', 'json', 'xml']; // 注意顺序
    super(id, ['addEntry', 'removeEntry', 'addFile', 'removeFile']);
    this.fileMap = new Map(types.map(type => [type, undefined]));
    this.files = new Map();
    this.canUse = false;
    this.role = role;
    this.base = (RoleConfig[role] && RoleConfig[role].base) || 'xml';
  }

  onFileAdd(fileDep, type) {
    this.fileMap.set(type, fileDep.id);
    const types = this.files.get(fileDep) || new Set();
    types.add(type);
    this.files.set(fileDep, types);
    if (type === this.base) {
      this.canUse = true;
      this.active();
    } else if (this.canUse) {
      this.eventBus.emit('addFile', this, fileDep, type);
    }
  }

  onFileRemove(fileDep) {
    const types = this.files.get(fileDep) || new Set();
    this.files.delete(fileDep);
    for (const type of types) {
      this.fileMap.set(type, undefined);
    }
    if (types.has(this.base)) {
      this.canUse = false;
      this.disable();
    } else if (this.canUse) {
      this.eventBus.emit('removeFile', this, fileDep, new Set(types));
    }
    types.clear();
  }

  active() {
    !this.activity && this.eventBus.emit('addEntry', this);
    this.activity = true;
  }

  disable() {
    this.activity && this.eventBus.emit('removeEntry', this);
    this.activity = false;
  }
}

module.exports = {
  FileDep,
  EntryDep,
};
