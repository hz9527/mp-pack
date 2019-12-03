const fs = require('fs');
let hasCheck = false;
function checkEnv(env) {
  if (!hasCheck && env !== 'mobile' && env !== 'pc') {
    console.error(`env must be mobile or pc`);
  }
  hasCheck = true;
}

const defaultResolveIdFactory = (env, pcExt, mobileExt, exts) => {
  checkEnv(env);
  const pathExt = env === 'pc' ? pcExt : mobileExt;
  return (id, type) => {
    if (pathExt) {
      let res;
      // 支持多种后缀
      if (typeof exts[type] === 'string') {
        res = `${id}${pathExt}.${exts[type]}`;
      } else {
        const ext = exts[type].find(f => fs.existsSync(`${id}${pathExt}.${f}`));
        res = `${id}${pathExt}.${ext || exts[type][0]}`;
      }
      return fs.existsSync(res) ? res : void 0;
    }
  };
};
const defaultResolveJsonFactory = env => {
  return (file, type) => {
    if (type === 'json') {
      return new Promise((resolve, reject) => {
        fs.readFile(file, (err, fd) => {
          err && reject(err);
          try {
            const { mobile, pc, ...rest } = JSON.parse(fd.toString());
            resolve(JSON.stringify({ ...rest, ...(env === 'mobile' ? mobile : pc) }));
          } catch (e) {
            reject(e);
          }
        });
      });
    }
  };
};
module.exports = function multiple({
  env, // mobile / pc
  mobileExt = '-m',
  pcExt = '',
  resolveIdFactory = defaultResolveIdFactory,
  resolveJsonFactory = defaultResolveJsonFactory,
} = {}) {
  if (!env) {
    console.warn(`${env} is invaild env config`);
  }
  let exts;
  let handler = null;
  const load = resolveJsonFactory(env);
  return {
    options(options) {
      exts = options.entry.ext;
    },
    resolveId(...args) {
      if (!handler) {
        handler = resolveIdFactory(env, pcExt, mobileExt, exts);
      }
      return handler(...args);
    },
    load,
  };
};
