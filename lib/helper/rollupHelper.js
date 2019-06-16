function plugin(packer) {
  return {
    name: 'mutilOutput',
    load(file) {
      return packer.load(file);
    },
    transform(code, file) {
      return packer.transform(file, code);
    },
    watchChange(id) {
    },
  };
}

// 事先将options钩子执行了，调用已经持有options引用，所以每次plugin需要引用隔离
function initOptions(packer, options) {
  const { pluginDriver: { context } } = packer;
  const { inputOptions, outputOptions } = options;
  const inputOpt = { ...inputOptions };
  const allPlugins = (inputOpt.plugins || [])
    .concat((inputOpt.appendPlugins || []).map(([plugin, opt]) => plugin(opt, context)));
  inputOpt.plugins = allPlugins;
  inputOpt.plugins.unshift(plugin(packer));
  return { inputOptions: inputOpt, outputOptions };
}

function initInputs(entries, packer) {
  const { entry } = packer;
  return entries.reduce((res, [file, entryId]) => {
    const key = entryId.replace(entry, '');
    res[key[0] === '/' ? key.slice(1) : key] = file;
    return res;
  }, {});
}

module.exports = {
  initOptions,
  initInputs,
};
