const { CODE, removeItem } = require('./info');
class EventBus {
  constructor(names = []) {
    this.listeners = names.reduce((res, name) => {
      res[name] = [];
      return res;
    }, {});
  }

  on(name, fn, options) {
    let handler = fn;
    if (options) {
      if (options.once) {
        handler = (...args) => {
          this.off(name, handler);
          return fn(...args);
        };
      }
      if (options.user) {
        handler = fn.bind(options.user);
      }
    }
    this.listeners[name].push(handler);
    return handler;
  }

  off(name, handler) {
    if (name) {
      const list = this.listeners[name];
      if (handler) {
        const ind = list.indexOf(handler);
        ind > -1 && list.splice(ind, 1);
        return ind !== -1;
      }
      list.length = 0;
      return true;
    } else {
      Object.keys(this.listeners).forEach(n => this.off(n));
    }
  }

  emit(name, ...args) {
    const list = this.listeners[name];
    for (let i = 0; i < list.length; i++) { // 不能使用 forEach，不能缓存 length
      list[i](...args);
    }
  }
}

// const shareEvent = new EventBus(['log']);

class ErrorInfo {
  constructor(err, info) {
    if (err.constructor === ErrorInfo) {
      return err;
    }
    this.error = err;
    this.info = info;
  }
}

function warpperInfo(key, err) {
  const code = CODE[key];
  const result = { code };
  if (err) {
    result.error = err.error;
  }
  return result
}

module.exports = {
  EventBus,
  removeItem,
  ErrorInfo,
  warpperInfo,
};
