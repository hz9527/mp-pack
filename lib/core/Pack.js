const fs = require('fs-extra');
const { Loader } = require('../helper/base');
const { EventBus, ErrorInfo } = require('../utils/utils');
const postcssrc = require('postcss-load-config');
const { resolveOpt: resolvePostcssOpt, resolveOptItem: resolvePostcssItem } = require('../helper/postcssHelper');
const { initOptions: initRollupOpt, initInputs: getRollupInputs } = require('../helper/rollupHelper');
const { rollup, watch: rollupWatch } = require('rollup');
const { getConf: getAssetsConf, getTask: getAssetsTask, match: matchAssets } = require('../helper/assetsHelper');

function errorHandler(err, info) {
  return Promise.reject(new ErrorInfo(err, info));
}
let buildId = 0;
class BasePacker {
  constructor(getOutput, pluginDriver, type, events = ['error', 'start', 'end']) {
    this.getOutput = getOutput;
    this.pluginDriver = pluginDriver;
    this.type = type;
    this.eventBus = new EventBus(events);
  }

  buildItem(file, entryId) {
    ++buildId;
    const id = buildId;
    this.eventBus.emit('start', this.type, id);
    return this.load(file)
      .then(source => this.transform(file, source, entryId))
      .then(code => this.output(entryId, code, file))
      .then(
        () => this.eventBus.emit('end', this.type, id),
        err => this.eventBus.emit('error', new ErrorInfo(err, { file, type: `build ${this.type}` }, id)),
      );
  }

  load(file) { // 职责为将文件名变为 字符串，如.vue 取出 xml 部分 字符串，然后转化成相应打包器识别的内容
    return this.pluginDriver.runHook('load', file, this.type)
      .then(code => Loader[this.type](file, code))
      .catch(err => errorHandler(err, { file, type: 'load' }));
  }

  transform(file, source) {
    return this.pluginDriver.runHook('transform', source, file, this.type)
      .catch(err => errorHandler(err, { file, type: 'transform' }));
  }

  output(entryId, code, file) {
    return fs.outputFile(this.getOutput(entryId, this.type), code)
      .catch(err => errorHandler(err, { file, type: 'output' }));
  }
};

class EntryPacker extends BasePacker {
  constructor(getOutput, pluginDriver, type) {
    super(getOutput, pluginDriver, type, ['error', 'update', 'start', 'end']);
  }

  transform(file, source, entryId) {
    return super.transform(file, source)
      .then(obj => {
        this.eventBus.emit('update', obj, entryId);
        return this.format(obj);
      }).catch(err => errorHandler(err, { file, type: 'format' }));
  }

  format(source) {
    return source;
  }
}
class JSONPacker extends EntryPacker {
  constructor(getOutput, pluginDriver) {
    super(getOutput, pluginDriver, 'json');
  }

  format(source) {
    return JSON.stringify(source);
  }
}

class XMLPacker extends EntryPacker {
  constructor(getOutput, pluginDriver) {
    super(getOutput, pluginDriver, 'xml');
  }

  format(source) {
    return source.toString();
  }
}

class CssPacker extends BasePacker {
  constructor(getOutput, pluginDriver, getEntries, config, output) {
    super(getOutput, pluginDriver, 'css');
    this.getEntries = getEntries;
    this.target = output;
    this.entries = new Map();
    this.config = config;
    this.pipes = null;
  }

  initConfig() {
    if (this.pipes) {
      return Promise.resolve();
    }
    const { rcCtx, rcPath, options } = this.config;
    return postcssrc(rcCtx, rcPath, options)
      .then(
        res => resolvePostcssOpt(res, this),
        () => resolvePostcssOpt(null, this),
      ).then(pipes => {
        this.pipes = pipes;
      });
  }

  build() {
    const oldMap = new Map(this.entries);
    this.entries.clear();
    return this.initConfig()
      .then(() => Promise.all(
        this.getEntries(this.type)
          .filter(entries => !oldMap.has(entries[0]))
          .map(entries => this.buildItem(...entries)),
      ))
      .catch(err => errorHandler(err, { file: 'all', type: 'buildCss' }));
  }

  buildItem(file, entryId) {
    this.entries.set(file, entryId);
    return super.buildItem(file, entryId);
  }

  output(entryId, thought, file) {
    return new Promise((resolve, reject) => {
      const pipes = resolvePostcssItem(file, this, entryId);
      const task = pipes.reduce((task, plugin) => task.pipe(plugin), thought);
      task.on('finish', resolve);
      task.on('error', reject);
    });
  }
}

class JsPacker extends BasePacker {
  constructor(getOutput, pluginDriver, getEntries, options, entry) {
    super(getOutput, pluginDriver, 'js');
    this.getEntries = getEntries;
    this.entry = entry;
    this.entries = new Map();
    this.isWatch = null;
    this.watcher = null;
    this.config = initRollupOpt(this, options);
    this.buildId = 0;
  }

  init(isWatch) {
    this.isWatch = isWatch;
  }

  build() {
    ++buildId;
    const id = buildId;
    this.entries = new Map(this.getEntries(this.type));
    const input = getRollupInputs(Array.from(this.entries), this);
    const promise = this.isWatch ? this.$watch(input, id) : this.$build(input, id);
    return promise.catch(
      err => this.eventBus.emit('error', new ErrorInfo(err, { file: 'all', type: 'rollup' }), id),
    );
  }

  buildItem(file, entryId, type, isRoot) {
    if (type !== 'update') {
      this.build();
    } else if (!isRoot) {
      const atime = fs.statSync(file).atime;
      fs.utimesSync(file, atime, new Date());
    }
  }

  $build(input, buildId) {
    this.eventBus.emit('start', this.type, buildId);
    const { inputOptions, outputOptions } = this.config;
    return rollup({ ...inputOptions, input })
      .then(bundle => {
        return bundle.write(outputOptions);
      }).then(() => this.eventBus.emit('end', this.type, buildId));
  }

  $watch(input, buildId) {
    const { inputOptions, outputOptions: output } = this.config;
    this.watcher && this.watcher.close();
    return new Promise((resolve, reject) => {
      this.watcher = rollupWatch({
        ...inputOptions,
        input,
        output,
      });
      this.watcher.on('event', event => {
        if (event.code === 'START') {
          this.buildId && this.eventBus.emit('end', this.type, this.buildId);
          this.buildId = buildId;
          this.eventBus.emit('start', this.type, buildId);
        } else if (event.code === 'END') {
          this.buildId = null;
          this.eventBus.emit('end', this.type, buildId);
          resolve();
        } else if (event.code === 'FATAL') { // 'ERROR'
          this.buildId = null;
          reject(event.error);
        }
      });
    });
  }
}

class AssetsPacker {
  constructor(pluginDriver, options, entry, output) {
    this.pluginDriver = pluginDriver;
    this.options = options;
    this.conf = getAssetsConf(options);
    this.eventBus = new EventBus(['error', 'start', 'end']);
    this.files = new Set();
    this.entry = entry;
    this.output = output;
  }

  build() {
    return this.runTask(this.conf);
  }

  runTask(conf) {
    if (conf === null) {
      return Promise.resolve();
    }
    const task = getAssetsTask(conf, this);
    ++buildId;
    const id = buildId;
    this.eventBus.emit('start', 'assets', id);
    return new Promise((resolve, reject) => {
      task.on('finish', () => {
        this.eventBus.emit('end', 'assets', id);
        resolve();
      });
      task.on('error', err => {
        this.eventBus.emit('error', new ErrorInfo(err, { file: conf, type: 'assets' }), id);
        reject(err);
      });
    });
  }

  onUpdate(file) { // update or add
    if (this.files.has(file) || matchAssets(file, this.options)) {
      return this.runTask(file);
    }
  }

  addFile(file) {
    this.files.add(file);
  }
}

function formatErr(err, type) {
  if (!err || typeof err === 'string') {
    return err || 'error';
  }
  if (type === 'rollup') {
    return JSON.stringify(err, undefined, 2);
  }
  return err.message;
}
module.exports = {
  XMLPacker,
  JSONPacker,
  CssPacker,
  JsPacker,
  AssetsPacker,
  formatErr,
};
