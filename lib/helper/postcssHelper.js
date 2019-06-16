const postcss = require('postcss');
const gulpPostcss = require('gulp-postcss');
const gulpRename = require('gulp-rename');
const { dest } = require('gulp');

const loadPkg = (pkg, options) => {
  if (typeof pkg !== 'string') {
    return;
  }
  const isOpt = options && options.constructor === Object && Object.keys(options).length > 0;
  return !isOpt ? require(pkg) : require(pkg)(options);
};

function checkHelper(result, opt, key) {
  const pkg = loadPkg(opt[key]);
  pkg && (result[key] = pkg);
}

function loadConfig(config) {
  const result = { options: {} };
  checkHelper(result.options, config, 'parser');
  checkHelper(result.options, config, 'syntax');
  checkHelper(result.options, config, 'stringifier');

  if (config.plugins) {
    let plugins = [];

    if (Array.isArray(config.plugins)) {
      plugins = config.plugins.filter(Boolean);
    } else {
      plugins = Object.keys(config.plugins)
        .filter(plugin => {
          return config.plugins[plugin] !== false ? plugin : '';
        })
        .map(plugin => {
          return loadPkg(plugin, config.plugins[plugin]);
        });
    }

    plugins = plugins.map((plugin, i) => {
      if (plugin.postcss) {
        plugin = plugin.postcss;
      }

      if (plugin.default) {
        plugin = plugin.default;
      }

      if (!plugin || typeof plugin !== 'function') {
        throw new Error(`${plugin} is invalid postcss plugin`);
      }
      return plugin;
    }).filter(i => i);
    result.plugins = plugins;
  }
  return result;
}

const connetImportPlugin = postcss.plugin('connet-import', options => {
  const { context } = options;
  return root => {
    const fileName = root.source.input.file;
    const deps = new Set();
    root.nodes.forEach(rule => {
      const name = rule.source.input.file;
      name !== fileName && deps.add(name);
    });
    // root.walkRules(rule => {
    //   const name = rule.source.input.file;
    //   if (name === fileName) {
    //     return;
    //   }
    //   deps.add(name);
    // });
    context.updateDeps(fileName, Array.from(deps));
    return root;
  };
});

let postcssPlugin;

function initPlugin(packer) {
  const { pluginDriver: { context } } = packer;
  postcssPlugin = connetImportPlugin({ context });
}

function resolveOpt(postcssConf, packer) {
  const { pluginDriver: { context } } = packer;
  const { options, gulpConfig, appendPlugins = [] } = packer.config;
  const config = postcssConf || loadConfig(options); // options & plugins
  config.plugins = config.plugins.map(fn => fn.name === 'creator' ? fn() : fn)
    .concat(appendPlugins.map(([plugin, opt]) => plugin(opt, context)))
    .filter(item => !!item);
  packer.config.config = config; // postcss config

  const { plugins = [], appendPlugins: gulpAppend = [] } = gulpConfig;
  const pipes = [];
  const allPlugin = plugins.concat(gulpAppend.map(([plugin, opt]) => plugin(opt, context)))
    .filter(item => !!item);
  allPlugin.forEach(plugin => typeof plugin === 'function' && pipes.push(plugin));
  gulpConfig.pipes = pipes;
  initPlugin(packer);
  return pipes;
}

function resolveOptItem(file, packer, entryId) {
  const { target, type, pipes: gulpPipes } = packer;
  const { config } = packer.config;
  const pipes = gulpPipes.map(fn => fn(file))
    .filter(fn => !!fn); // todo
  const { plugins, options } = config;
  if (plugins.every(fn => fn.postcssPlugin !== 'postcss-import')) {
    // push postcss-import
    plugins.unshift(loadPkg('postcss-import', {})());
  }
  pipes.unshift(
    gulpPostcss(plugins.concat([postcssPlugin]), options),
  );
  const outFile = packer.getOutput(entryId, type).replace(target, '');
  const ind = outFile.lastIndexOf('.');
  const fInd = outFile.lastIndexOf('/');
  pipes.push(gulpRename(item => Object.assign(item, { dirname: outFile.slice(1, fInd), extname: outFile.slice(ind) })));
  pipes.push(dest(target));
  return pipes;
}

module.exports = {
  resolveOpt,
  resolveOptItem,
};
