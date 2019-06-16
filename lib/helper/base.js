const vinyl = require('vinyl-source-stream');
const fs = require('fs-extra');
const { src: gulpSrc } = require('gulp');
const XMLParser = require('./xml/index');

const xmlParser = new XMLParser();
const Loader = {
  js(file, code) {
    return code;
  },
  css(file, code) {
    if (code && (typeof code === 'string' || (code.constructor === Object && typeof code.code === 'string'))) {
      const stream = vinyl(file);
      stream.end(code.code || code);
      return stream;
    }
    return gulpSrc(file);
  },
  xml(file, code) {
    const source = code || fs.readFileSync(file);
    return xmlParser.parse(source);
  },
  json(file, code) {
    return code ? JSON.parse(code) : fs.readJSON(file);
  },
};

module.exports = {
  Loader,
};
