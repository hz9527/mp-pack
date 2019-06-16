const { Transform } = require('stream');

function projectReplace(opt) {
  const { file, envs = {} } = opt;
  const keys = Object.keys(envs).map(key => key.replace(/(\.)/g, '\\.'));
  const baseReg = keys.length ? `(${keys.join('|')})` : '';
  const regexp = new RegExp(`${baseReg}`, 'g');
  const matchReg = new RegExp(`^${baseReg}$`);
  const handler = (key, v) => {
    if (typeof v === 'string') {
      if (matchReg.test(v)) {
        return envs[v];
      }
      return v.replace(regexp, (sub, k) => envs[k]);
    }
    return v;
  };
  return () => new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      if (chunk.path === file) {
        if (chunk.isBuffer()) {
          // eslint-disable-next-line no-param-reassign
          chunk.contents = Buffer.from(
            JSON.stringify(
              JSON.parse(chunk.contents.toString(), handler),
              void 0,
              2,
            ),
          );
        }
      }
      callback(null, chunk);
    },
  });
}

module.exports = projectReplace;
