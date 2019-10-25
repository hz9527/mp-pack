const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');
const { FileManager, EntryManager, PackManager } = require('./managers');
const { PluginDriver, contextFactory } = require('./pluginDriver');
const { formatErr } = require('./Pack');
const { Loger } = require('../utils/info');
const { warpperInfo } = require('../utils/utils');
const Watcher = require('./Watcher');

module.exports = class Packer {
  constructor(options) {
    this.options = options;
    this.bind();
    this.loger = new Loger();
    this.packerManager = new PackManager(this);
    this.entryManager = new EntryManager(this);
    this.fileManager = new FileManager();
    const pluginContext = contextFactory(this);
    this.pluginDriver = new PluginDriver(options.plugins, void 0, pluginContext);
    this.pluginDriver.runHook('options', options);
    this.watcher = new Watcher();
    this.listeners = [];
    this.init();
    this.resolve = null;
    this.reject = null;
  }

  get entry() {
    return this.options.entry.path;
  }

  init() {
    if (fs.existsSync(this.options.output.path)) {
      execSync(`rm -rf ${this.options.output.path}`);
    }
    this.initEvent();
  }

  bind() {
    this.isAppId = this.isAppId.bind(this);
    this.resolveId = this.resolveId.bind(this);
    this.getOutput = this.getOutput.bind(this);
    this.relativeId = this.relativeId.bind(this);
  }

  initEvent() {
    this.entryManager.eventBus
      .on('addEntry', (...args) => this.packerManager.onAddEntry(...args));
    this.entryManager.eventBus
      .on('removeEntry', (...args) => this.packerManager.onRemoveEntry(...args));
    this.entryManager.eventBus
      .on('addFile', (...args) => this.packerManager.onAddFile(...args));
    this.entryManager.eventBus
      .on('removeFile', (...args) => this.packerManager.onRemoveFile(...args));
    this.entryManager.eventBus
      .on('updateEntry', (...args) => this.packerManager.updateFile(...args));
    this.entryManager.eventBus
      .on('resolveFile', (...args) => this.fileManager.addFile(...args));

    this.entryManager.eventBus.on('error', file => {
      const info = warpperInfo('noPage');
      this.listeners.forEach(fn => fn(info));
      const msg = `page ${file} not exists`;
      this.loger.error('\n ' + msg);
      this.reject && this.reject(new Error(msg));
    });

    this.packerManager.eventBus
      .on('updateChild', (...args) => this.entryManager.updateChild(...args));

    this.packerManager.eventBus.on('error', err => {
      const info = warpperInfo('error', err);
      this.listeners.forEach(fn => fn(info));
      const content = formatErr(err.error, err.info.type);
      this.loger.error({
        title: err.info.type,
        desc: err.info.file,
        content,
        time: true,
      });
      this.reject && this.reject(err.error);
    });
    this.packerManager.eventBus.on('start', () => {
      const info = warpperInfo('buildStart');
      this.listeners.forEach(fn => fn(info));
      this.loger.loading('build start');
    });
    this.packerManager.eventBus.on('end', (isErr, buildId) => {
      const info = warpperInfo('buildFinish');
      this.listeners.forEach(fn => fn(info));
      this.loger.hideLoading(`build end ${buildId}`, isErr ? 'fail' : 'succeed', !this.resolve && !isErr);
      this.pluginDriver.runHook('buildEnd');
      this.resolve && this.resolve();
    });

    this.fileManager.eventBus
      .on('addFile', (...args) => {
        this.entryManager.onFileAdd(...args);
        args.length === 1 && this.packerManager.assetsPacker.onUpdate(args[0].id);
      });
    this.fileManager.eventBus
      .on('removeFile', (...args) => this.entryManager.onFileRemove(...args));
    this.fileManager.eventBus
      .on('addFail', (...args) => this.entryManager.onFailAddFail(...args));
    this.fileManager.eventBus
      .on('updateFile', (...args) => {
        this.entryManager.onFileUpdate(...args);
      });
  }

  isAppId(entryId) {
    return path.resolve(this.entry, this.options.entry.name) === entryId;
  }

  resolveId(entryId, type) { // 将 entryId 转化为文件路径
    const file = this.pluginDriver.runHook('resolveId', entryId, type);
    if (file) {
      return file
    }
    // 支持多种后缀
    if (typeof this.options.entry.ext[type] === string) {
      return `${entryId}.${this.options.entry.ext[type]}`
    }
    const ext = this.options.entry.ext[type].find(ext => fs.execSync(`${entryId}.${ext}`))
    return `${entryId}.${ext || this.options.entry.ext[type][0]}`
  }

  relativeId(baseId, relativePath) { // 计算 entryId
    if (this.isAppId(baseId)) {
      return path.resolve(this.entry, relativePath);
    } else {
      const isAbsolute = relativePath[0] === '/';
      const base = isAbsolute ? this.entry : baseId.slice(0, baseId.lastIndexOf('/'));
      const rest = isAbsolute ? relativePath.slice(1) : relativePath;
      return path.resolve(base, rest);
    }
  }

  getOutput(entryId, type) {
    if (type) {
      const { output: { ext, path: output } } = this.options;
      return entryId.replace(this.entry, output) + `.${ext[type]}`;
    }
    return this.options.output.path;
  }

  start(isWatch = false) {
    const { path: ePath, name } = this.options.entry;
    this.packerManager.start(this, isWatch);
    this.entryManager.addEntry(path.resolve(ePath, name), 'app');
  }

  async build() {
    await this.pluginDriver.runHook('buildStart');
    this.start();
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  watch() {
    this.watcher.init(this.entry);
    this.watcher.eventBus.on('change',
      file => {
        this.fileManager.onFileUpdate(file);
        this.packerManager.assetsPacker.onUpdate(file);
      });
    this.watcher.eventBus.on('addFile',
      file => this.fileManager.addFile(file));
    this.watcher.eventBus.on('removeFile',
      file => this.fileManager.onFileRemove(file));
    // warpper watcher
    const close = () => {
      this.watcher.close();
      this.packerManager.close();
    };
    const on = fn => {
      typeof fn === 'function' && this.listeners.push(fn);
    };
    process.on('uncaughtException', err => {
      this.packerManager.resetStack(err);
    });
    // start
    this.pluginDriver.runHook('buildStart')
      .then(() => this.start(true));
    return { close, on };
  }
};
