const fs = require('fs');
const {
  DefaultName, DefaultEntryExt, DefaultOutputExt,
  RollupBaseOutput, PostcssBaseConf, GulpCssBaseConf,
} = require('./packDefaultConf');
const { error } = require('../utils/info');
/**
 *
 * @param
 {
  entry: string | {
    path: string,
    name: string, // default is app
    ext: {js: string, css: string, xml: string, json: string} // default js scss wxml json
  },
  output: string | {
    path: string,
    name: string, // default is app
    ext: {js: string, css: string, xml: string, json: string} // default js wxss wxml json
  },
  plugins: Plugin[],
  rollupConfig: {
    inputOptions,
    outputOptions,
    appendPlugins: [string | function, options][] // 提供额外参数插件
  },
  postcssConfig: {
    rcCtx: postcssrcContext,
    rcPath: postcssrcPath,
    options: postcssrcOptions,
    appendPlugins: [string | function, options][] // 提供额外参数插件
    gulpConfig: {
      plugins: [],
      appendPlugins: [string | function, options][] // 提供额外参数插件
    }
  },
  assets: {
    include: [],
    exclude: [],
    plugins: [],
    appendPlugins: []
  },
  onwarn: function
}
 */

function genDirConf(conf, isEntry = true) {
  const dir = typeof conf === 'string' ? conf : conf && conf.path;
  let hasError = !dir;
  if (!hasError && isEntry) {
    hasError = !fs.existsSync(dir) || !fs.statSync(dir).isDirectory();
  }
  if (hasError) {
    error({
      code: isEntry ? 'ENTRY_DIR_IS_INVAILD' : 'NO_OUTPUT',
      message: `${dir} is invalid`,
    });
  }
  const ext = isEntry ? DefaultEntryExt : DefaultOutputExt;
  if (conf.ext) {
    Object.keys(ext).forEach(key => {
      if (typeof conf.ext[key] === 'string') {
        ext[key] = conf.ext[key];
      }
    });
  }
  return {
    path: dir,
    name: conf.name || DefaultName,
    ext,
  };
}

function resolveAppendPlugins(list) {
  const result = [];
  if (!list || list.constructor !== Array) {
    error();
  }
  for (let i = 0, l = list.length; i < l; i++) {
    if (!list[i] || list[i].constructor !== Array) {
      error({ code: 'INVALID_PLUGIN', msg: list[i] });
    }
    const [plugin, options = {}] = list[i];
    let item;
    try {
      item = typeof plugin === 'function' ? [plugin] : [require(plugin)];
    } catch (err) {
      error({ code: 'INVALID_PLUGIN', msg: plugin });
    }
    item.push(options);
  }
  return result;
}
const PostcssDefault = {
  options: PostcssBaseConf, appendPlugins: [], gulpConfig: { appendPlugins: [], ...GulpCssBaseConf },
};
function resolveConfig(config = {}) {
  const { entry, output, onwarn, plugins, rollupConfig, postcssConfig, assets, copyFiles, clear } = config;
  const result = {};

  result.entry = genDirConf(entry);

  result.output = genDirConf(output, false);

  result.onwarn = onwarn;
  result.plugins = plugins && plugins.constructor === Array ? plugins : [];

  const outputOpt = { ...RollupBaseOutput, dir: result.output.path };
  result.rollupConfig = { inputOptions: {}, outputOptions: outputOpt, appendPlugins: [] };
  if (rollupConfig) {
    const { inputOptions, outputOptions, appendPlugins = [] } = rollupConfig;
    result.rollupConfig.inputOptions = Object.assign({}, inputOptions || {});
    result.rollupConfig.outputOptions = Object.assign(RollupBaseOutput, outputOptions || { dir: result.output.path });
    result.rollupConfig.appendPlugins = resolveAppendPlugins(appendPlugins);
  }

  result.postcssConfig = PostcssDefault;
  if (postcssConfig) {
    const { rcCtx, rcPath, options = {}, appendPlugins = [], gulpConfig = {} } = postcssConfig;
    Object.assign(result.postcssConfig, { rcCtx, rcPath });
    Object.assign(result.postcssConfig.options, options);
    result.postcssConfig.appendPlugins = resolveAppendPlugins(appendPlugins);
    const { plugins, appendPlugins: append = [] } = gulpConfig;
    if (plugins && plugins.constructor === Array) {
      result.postcssConfig.gulpConfig.plugins = plugins;
    }
    result.postcssConfig.gulpConfig.appendPlugins = resolveAppendPlugins(append);
  }

  if (assets || copyFiles) { // 向下兼容 copyFiles 选项
    const { include = [], exclude = [], plugins = [], appendPlugins = [] } = assets || copyFiles;
    result.assets = { include, exclude, plugins, appendPlugins: resolveAppendPlugins(appendPlugins) };
  } else {
    result.assets = { include: [], exclude: [], plugins: [], appendPlugins: [] };
  }
  result.clear = clear !== false;
  return result;
}

module.exports = resolveConfig;
