const Stream = require('stream');
const { src, dest } = require('gulp');
const minimatch = require('minimatch');

function gulpPlugin(files) {
  const stream = new Stream.Transform({ objectMode: true });
  stream._transform = function(file, unused, callback) {
    files.add(file.path);
    callback(null, file);
  };

  return stream;
}

function getConf(options) {
  const { include = [], exclude = [] } = options;
  const conf = include.concat(exclude.map(item => `!${item}`));
  return conf.length === 0 ? false : conf;
}

function getTask(conf, packer) {
  const { entry, output, files, options, pluginDriver } = packer;
  const { plugins, appendPlugins } = options;
  const { context } = pluginDriver;
  const pipes = [gulpPlugin(files)]
    .concat(plugins.map(fn => fn()))
    .concat(appendPlugins.map(([plugin, opt]) => plugin(opt, context)));
  pipes.push(dest(output));
  return pipes.reduce((res, item) => res.pipe(item), src(conf, { base: entry }));
}

function match(file, options) {
  const { include = [], exclude = [] } = options; // include some; exclude some
  const result = include.some(p => minimatch(file, p));
  if (result) {
    return !exclude.some(p => minimatch(file, p));
  }
  return result;
}

module.exports = {
  getConf,
  getTask,
  match,
};
