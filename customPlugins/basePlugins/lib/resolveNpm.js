const path = require('path');
const fs = require('fs');

function resolveNpm(opt = {}) {
  const options = { ...opt };
  return {
    resolveId: id => {
      if (options[id]) {
        try {
          const res = typeof options[id] === 'function' ? options[id](id) : options[id];
          if (res) {
            return res;
          }
        } catch (e) {
          console.log(e);
        }
      }
      return null;
    },
  };
};

module.exports = resolveNpm;
