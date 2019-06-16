const gulpSass = require('gulp-sass');
const replaceTagSelectorMap = require('postcss-mpvue-wxss/lib/wxmlTagMap');
const DefaultName = 'app';
const DefaultEntryExt = {
  xml: 'wxml',
  js: 'js',
  css: 'scss',
  json: 'json',
};
const DefaultOutputExt = {
  xml: 'wxml',
  js: 'js',
  css: 'wxss',
  json: 'json',
};

const RollupBaseOutput = { cache: true, format: 'esm', chunkFileNames: 'libs/[name].js' };

const PostcssBaseConf = {
  plugins: {
    'postcss-import': {},
    'postcss-mpvue-wxss': {
      cleanSelector: ['*'],
      remToRpx: 100,
      replaceTagSelector: Object.assign(replaceTagSelectorMap, {
        '*': 'view, text',
      }),
    },
  },
  parser: 'postcss-scss',
};

const GulpCssBaseConf = {
  plugins: [() => gulpSass()],
};

module.exports = {
  DefaultName,
  DefaultEntryExt,
  DefaultOutputExt,
  RollupBaseOutput,
  PostcssBaseConf,
  GulpCssBaseConf,
};
