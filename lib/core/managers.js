// entryManager packManager fileManager
const fs = require('fs-extra');
const { EventBus, removeItem, ErrorInfo } = require('../utils/utils');
const { FileDep, EntryDep } = require('./dep');
const { JsPacker, CssPacker, XMLPacker, JSONPacker, AssetsPacker } = require('./Pack');

class FileManager {
  constructor() {
    this.files = new Map(); // <fileName, fileDep>
    this.eventBus = new EventBus(['addFile', 'removeFile', 'addFail', 'updateFile']);
  }

  addFile(file, ...rest) {
    let fileDep;
    if (this.files.has(file)) {
      fileDep = this.files.get(file);
    } else {
      fileDep = new FileDep(file);
      this.files.set(file, fileDep);
    }
    if (fileDep.init()) {
      this.eventBus.emit('addFile', fileDep, ...rest);
    } else if (rest.length && !fileDep.exists) {
      this.eventBus.emit('addFail', fileDep, ...rest);
    }
    fileDep.eventBus.on('update', (dep, isRoot) => this.eventBus.emit('updateFile', fileDep, isRoot));
    return fileDep;
  }

  onFileUpdate(file) {
    if (this.files.has(file)) {
      const fileDep = this.files.get(file);
      fileDep.update(true);
    }
  }

  onFileRemove(file) {
    if (this.files.has(file)) {
      const fileDep = this.files.get(file);
      fileDep.remove();
      fileDep.eventBus.off();
      this.files.delete(file);
      this.eventBus.emit('removeFile', fileDep);
    }
  }

  disableFile(file) { // todo disable entry

  }

  updateDeps(file, files) {
    if (this.files.has(file)) {
      this.files.get(file).updateDeps(files.map(f => this.addFile(f)));
    }
  }
}

class EntryManager {
  constructor(pack) {
    this.resolveId = pack.resolveId;
    this.entries = new Map(); // <entryId, entryDep>
    this.fileMap = new Map(); // <file, {entryDep, types}>
    this.eventBus = new EventBus(
      ['addEntry', 'removeEntry', 'addFile', 'removeFile', 'updateEntry', 'error', 'resolveFile'],
    );
  }

  addEntry(entryId, role) {
    return this.entries.has(entryId)
      ? this.entries.get(entryId)
      : this.createEntry(entryId, role);
  }

  createEntry(entryId, role) {
    const entryDep = new EntryDep(entryId, role);
    this.entries.set(entryId, entryDep);
    entryDep.eventBus.on('addEntry', () => {
      this.eventBus.emit('addEntry', entryDep);
    });
    entryDep.eventBus.on('removeEntry', () => {
      this.eventBus.emit('removeEntry', entryDep);
    });
    entryDep.eventBus.on('addFile', (...args) => {
      this.eventBus.emit('addFile', ...args);
    });
    entryDep.eventBus.on('removeFile', (...args) => {
      this.eventBus.emit('removeFile', ...args);
    });
    const { base } = entryDep;
    for (const type of entryDep.fileMap.keys()) {
      this.initFile(entryDep, type, type === base);
    }
    return entryDep;
  }

  initFile(entryDep, type, isBase = false) {
    const file = this.resolveId(entryDep.id, type);
    let data;
    if (this.fileMap.has(file)) {
      data = this.fileMap.get(file);
    } else {
      data = { entryDep, types: new Set() };
      this.fileMap.set(file, data);
    }
    data.types.add(type);
    this.eventBus.emit('resolveFile', file, type, isBase);
  }

  onFileAdd(fileDep, type) {
    if (this.fileMap.has(fileDep.id)) {
      const { entryDep, types } = this.fileMap.get(fileDep.id);
      const keys = type ? new Set([type]) : types;
      for (const t of keys) {
        entryDep.onFileAdd(fileDep, t);
      }
    }
  }

  onFailAddFail(fileDep, type, isBase) {
    const { types } = this.fileMap.get(fileDep.id);
    types.delete(type);
    isBase && this.eventBus.emit('error', fileDep.id);
  }

  onFileRemove(fileDep) {
    if (this.fileMap.has(fileDep.id)) {
      const { entryDep, types } = this.fileMap.get(fileDep.id);
      for (const t of types) {
        entryDep.onFileAdd(fileDep, t);
      }
      types.clear();
    }
  }

  onFileUpdate(fileDep, isRoot) {
    if (this.fileMap.has(fileDep.id)) {
      const { entryDep, types } = this.fileMap.get(fileDep.id);
      this.eventBus.emit('updateEntry', fileDep, entryDep, types, isRoot);
    }
  }

  updateChild(entryId, entries) { // entryId role
    if (this.entries.has(entryId)) {
      const entryDep = this.entries.get(entryId);
      entryDep.updateDeps(entries.map(({ entryId, role }) => this.addEntry(entryId, role)));
    }
  }
}

class PackManager {
  constructor(pack) {
    const { getOutput, relativeId, isAppId } = pack;
    this.getOutput = getOutput;
    this.relativeId = relativeId;
    this.isAppId = isAppId;
    this.eventBus = new EventBus(['updateChild', 'error', 'start', 'end']);
    this.useEntries = new Set();
    this.tasks = [];
    this.changes = new Set();
    this.stack = [];
  }

  start(pack, isWatch) {
    const { pluginDriver, getOutput, options, entry } = pack;
    const getEntries = this.getEntries.bind(this);
    const { rollupConfig, postcssConfig, assets, output } = options;
    this.jsonPacker = new JSONPacker(getOutput, pluginDriver);
    this.xmlPacker = new XMLPacker(getOutput, pluginDriver);
    this.cssPacker = new CssPacker(getOutput, pluginDriver, getEntries, postcssConfig, output.path);
    this.jsPacker = new JsPacker(getOutput, pluginDriver, getEntries, rollupConfig, entry);
    this.assetsPacker = new AssetsPacker(pluginDriver, assets, entry, output.path);
    this.jsPacker.init(isWatch);
    this.initEvents();
    this.assetsPacker.build();
  }

  get entries() {
    const list = [];
    for (const entryDep of this.useEntries) {
      list.push(entryDep.id);
    }
    return list;
  }

  getEntries(type) {
    const list = [];
    for (const entryDep of this.useEntries) {
      const file = entryDep.fileMap.get(type);
      file && list.push([file, entryDep.id]);
    }
    return list;
  }

  resetStack(err) {
    this.eventBus.emit('error', new ErrorInfo(err, { type: 'unhandlerError', file: '' }));
    if (this.stack.length) {
      this.stack.length = 0;
      this.eventBus.emit('end', true, '');
    }
  }

  initEvents() {
    let timer = null;
    let time = 1000 * 10;
    const end = (type, buildId, isErr = false) => {
      setTimeout(() => {
        if (this.stack.length) {
          removeItem(this.stack, buildId);
          !this.stack.length && this.eventBus.emit('end', isErr, buildId, type);
        }
      });
    };
    const start = (type, buildId) => {
      this.stack.push(buildId);
      if (this.stack.length === 1) {
        this.eventBus.emit('start', type);
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          if (time < 1000 * 59) {
            time += 500;
          }
          timer = null;
          this.stack.length && this.resetStack(new Error('build timeout'));
        }, time);
      }
    };
    const error = (err, buildId) => {
      end('', buildId, true);
      this.eventBus.emit('error', err);
    };
    Object.keys(PackManager.PackerMap).forEach(key => {
      this[PackManager.PackerMap[key]].eventBus.on('error', error);
      this[PackManager.PackerMap[key]].eventBus.on('start', start);
      this[PackManager.PackerMap[key]].eventBus.on('end', end);
    });
    this.assetsPacker.eventBus.on('start', start);
    this.assetsPacker.eventBus.on('end', end);
    this.assetsPacker.eventBus.on('error', error);
    for (const key of PackManager.BaseTypes) {
      const method = key === 'json' ? 'onJsonUpdate' : 'onXmlUpdate';
      this[PackManager.PackerMap[key]].eventBus.on('update', (obj, entryId) => {
        this[method](obj, entryId);
      });
    }
  }

  onJsonUpdate(obj, entryId) {
    const isApp = this.isAppId(entryId);
    let paths;
    if (isApp) {
      paths = obj.pages || [];
    } else {
      const components = obj.usingComponents || {};
      paths = Object.keys(components).map(key => components[key]);
    }
    entryId && this.finalUpdate(entryId, paths.map(p => ({ entryId: this.relativeId(entryId, p), role: isApp ? 'page' : 'component' })));
  }

  onXmlUpdate(nodes, entryId) {
    // resolve nodes
    const paths = [];
    nodes.walk(node => {
      if (node.type === 'tag' && node.name === 'import') {
        node.attrs.walk(attr => {
          attr.name === 'src' && paths.push({
            entryId: this.relativeId(entryId, attr.value),
            role: 'template',
          });
        });
      }
    });
    entryId && this.finalUpdate(entryId, paths);
  }

  finalUpdate(entryId, entries) {
    this.eventBus.emit('updateChild', entryId, entries);
    removeItem(this.tasks, entryId);
    if (this.tasks.length === 0) {
      this.jsPacker.build();
      this.cssPacker.build();
    }
  }

  updateFile(fileDep, entryDep, types, isRoot) {
    for (const type of types) {
      if (PackManager.BaseTypes.has(type)) {
        const packer = PackManager.PackerMap[type];
        this.tasks.push(entryDep);
        this[packer].buildItem(fileDep.id, entryDep.id, 'update', isRoot);
      } else {
        this.onAddFile(entryDep, fileDep, type);
      }
    }
  }

  onAddEntry(entryDep) { // resolveId & addFile
    this.useEntries.add(entryDep);
    for (const type of PackManager.BaseTypes) {
      if (entryDep.fileMap.has(type)) {
        const file = entryDep.fileMap.get(type);
        if (file) {
          const packer = PackManager.PackerMap[type];
          this.tasks.push(entryDep.id);
          this[packer].buildItem(file, entryDep.id, 'add');
        }
      }
    }
  }

  onRemoveEntry(entryDep) {
    this.useEntries.delete(entryDep);
    this.jsPacker.build();
    for (const type of entryDep.fileMap.keys()) {
      const fileDep = entryDep.fileMap.get(type);
      fileDep && this.removeFile(entryDep.id, type);
    }
  }

  onAddFile(entryDep, fileDep, type) {
    if (!this.useEntries.has(entryDep) || this.tasks.length) {
      return;
    }
    const packer = PackManager.PackerMap[type];
    this[packer].buildItem(fileDep.id, entryDep.id, 'add');
  }

  onRemoveFile(entryDep, fileDep, types) {
    if (!this.useEntries.has(entryDep) || this.tasks.length) {
      return;
    }
    this.removeFile(entryDep.id, types);
    if (types.has('js')) {
      this.jsPacker.buildItem(fileDep.id, entryDep.id, 'remove');
    }
    // get dir & empty
  }

  removeFile(entryId, types) {
    for (const type of types) {
      const output = this.getOutput(entryId, type);
      fs.removeSync(output);
    }
  }

  close() {
    this.jsPacker.watcher.close();
  }

  // static PackerMap = {
  //   json: 'jsonPacker',
  //   xml: 'xmlPacker',
  //   js: 'jsPacker',
  //   css: 'cssPacker',
  // }

  // static BaseTypes = new Set(['xml', 'json'])
}

PackManager.PackerMap = {
  json: 'jsonPacker',
  xml: 'xmlPacker',
  js: 'jsPacker',
  css: 'cssPacker',
};

PackManager.BaseTypes = new Set(['xml', 'json']);

module.exports = {
  FileManager,
  EntryManager,
  PackManager,
};
