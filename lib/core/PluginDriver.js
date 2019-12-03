const Version = require('../../package.json').version;
const DefaultConfig = [
  ['options', 'sequentialSync'],
  ['resolveId', 'firstSync'],
  ['load', 'first'],
  ['buildStart', 'parallel'],
  ['transform', 'reduce'],
  ['buildEnd', 'sequential'],
  // ['entryChange', 'parallel'],
  // ['watchChange', 'sequential'],
];

const firstDefault = value => value !== null && value !== void 0;
const NoCall = new Set(['runHook']);
const HasCheck = new Set(['first', 'firstSync']);

function init(plugins, config) {
  const result = {}; // {hookName: {type, hooks, check}}
  for (let i = 0, l = config.length; i < l; i++) {
    // check item todo
    const item = config[i];
    if (typeof PluginDriver.prototype[item[1]] && !NoCall.has(item[1])) {
      result[item[0]] = { type: item[1], hooks: [] };
      if (HasCheck.has(item[1])) {
        result[item[0]].check = typeof item[2] === 'function' ? item[2] : firstDefault;
      }
      const hooks = result[item[0]].hooks;
      for (let j = 0, len = plugins.length; j < len; j++) {
        if (typeof plugins[j][item[0]] === 'function') {
          hooks.push(plugins[j][item[0]]);
        }
      }
    }
  }
  return result;
}

function contextFactory(allPacker) {
  const { packerManager, fileManager, entryManager, resolveId, loger } = allPacker;
  return {
    get entries() {
      return packerManager.getEntries;
    },
    updateDeps(file, files) {
      return fileManager.updateDeps(file, files);
    },
    addAsset(file) {
      packerManager.assetsPacker.addFile(file);
    },
    meta: { mpPackVersion: Version },
    resolveFile(entryId, type) {
      const res = entryManager.entries.get(entryId);
      return res ? res.fileMap.get(type) : null;
    },
    resolveId,
    error: loger.error.bind(loger),
    warn: loger.warn.bind(loger),
  };
}

class PluginDriver {
  constructor(plugins, config = DefaultConfig, context = {}) {
    this.context = context;
    this.hookMap = init(plugins, config);
  }

  runHook(name, ...args) {
    const item = this.hookMap[name];
    if (item) {
      HasCheck.has(item.type) && args.unshift(item.check);
      return this[item.type](item.hooks, ...args);
    }
    return `${name} is invalid hook`;
  }

  reduce(hooks, arg0, ...args) { // reduce first arg
    let result = Promise.resolve(arg0);
    for (let i = 0, l = hooks.length; i < l; i++) {
      result = result.then(res => {
        arg0 = res === void 0 ? arg0 : res;
        return Promise.resolve(hooks[i].call(this.context, arg0, ...args));
      });
    }
    return result;
  }

  reduceSync(hooks, arg0, ...args) { // reduce first arg
    return hooks.reduce((res, hook) => {
      const back = hook.call(this.context, res, ...args); // can warn at back promise
      return (back === void 0 || back instanceof Promise) ? res : back;
    }, arg0);
  }

  sequential(hooks, ...args) {
    let promise = Promise.resolve();
    for (let i = 0, l = hooks.length; i < l; i++) {
      promise = promise.then(() => Promise.resolve(hooks[i].call(this.context, ...args)));
    }
    return promise;
  }

  sequentialSync(hooks, ...args) {
    for (let i = 0, l = hooks.length; i < l; i++) {
      hooks[i].call(this.context, ...args);
    }
  }

  parallel(hooks, ...args) {
    return Promise.all(hooks.map(hook => hook.call(this.context, ...args)));
  }

  first(hooks, check, ...args) { // first arg be default result, hooks will get args
    // let promise = Promise.resolve(); // 这种方案存在排队的问题
    // for (let i = 0, l = hooks.length; i < l; i++) {
    //   promise = promise.then(res => check(res) ? res : hooks[i].call(this.context, ...args));
    // }
    // return promise;
    return new Promise(resolve => {
      hooks.length === 0 && resolve();
      let task = 0;
      for (let i = 0, l = hooks.length; i < l; i++) {
        Promise.resolve(hooks[i].call(this.context, ...args))
          .then(res => {
            task++;
            (check(res) || task === l) && resolve(res);
          });
      }
    });
  }

  firstSync(hooks, check, ...args) {
    for (let i = 0, l = hooks.length; i < l; i++) {
      const back = hooks[i].call(this.context, ...args);
      if (back instanceof Promise) {
        continue; // warn
      } else {
        if (check(back)) {
          return back;
        }
      }
    }
  }
}

module.exports = { PluginDriver, contextFactory };
