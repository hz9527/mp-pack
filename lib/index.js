const resolveConf = require('./helper/resolveConf');
const Pack = require('./core/index');

function mpPack(config) {
  const opt = resolveConf(config);
  const pack = new Pack(opt);
  return pack.build();
}

function mpWatch(config) {
  const opt = resolveConf(config);
  const pack = new Pack(opt);
  return pack.watch();
}

module.exports = {
  mpPack,
  mpWatch,
};
