const ora = require('ora');
const chalk = require('chalk');
const readline = require('readline');
/**
 *{
   silence: 0 | 1 | 2,
   msgFormat: (type, ...args) => {title, desc, content, code},
  }
 */
// code NO_PAGE ERROR BUILD_FINISH BUILD_START

function removeItem(list, item) {
  const ind = list.indexOf(item);
  ind > -1 && list.splice(ind, 1);
}

function padNum(num, len = 2, fill = '0') {
  return num.toString(10).padStart(len, fill);
}

function getTime(time) {
  return `${padNum(time.getHours())}:${padNum(time.getMinutes())} ${padNum(time.getSeconds())}s`;
}

const LogConf = {
  title: {
    log: ['bgBlue'],
    warn: ['bgYellow'],
    error: ['bgRed'],
    success: ['bgGreen'],
  },
  desc: {
    log: ['blue'],
    warn: ['yellow'],
    error: ['red'],
    success: ['green'],
  },
  content: {
    log: ['gray'],
    warn: ['gray'],
    error: ['redBright'],
    success: ['gray'],
  },
};
const defaultFormate = (msg, code, title, content) => {
  if (msg && typeof msg === 'object') {
    return msg;
  }
  const res = {};
  msg && (res.desc = msg);
  code && (res.code = code);
  title && (res.title = title);
  content && (res.content = content);
  return res;
};
const defaultState = new Set([0, 1, 2, 3]);
const types = ['succeed', 'fail', 'warn'];
class Loger {
  constructor(options = {}) {
    this.listeners = {
      warn: [],
      log: [],
      error: [],
      success: [],
    };
    this.silence = defaultState.has(options.silence) ? options.silence : 0;
    this.ora = null;
    this.isLoading = false;
    this.msgFormat =
      typeof options.msgFormat === 'function' ? options.msgFormat : defaultFormate;
  }

  on(name, cb) {
    if (typeof cb === 'function' && this.listeners[name]) {
      this.listeners[name].push(cb);
    }
  }

  formatMsg(data = {}, type) {
    if (Loger.tasks.length) {
      this.ora.clear();
    }
    console.log('\n');
    Object.keys(LogConf).forEach(key => {
      if (data[key]) {
        const res = (LogConf[key][type] || []).reduce((res, exec) => res[exec], chalk);
        console.log((res && typeof data[key] === 'string' && res(data[key])) || data[key]);
      }
    });
    if (data.time) {
      console.log(chalk.bgBlue('log time:'), chalk.green(getTime(new Date())));
      console.log('\n');
    }
    this.listeners[type] && this.listeners[type].forEach(fn => fn(data));
  }

  warn(...args) {
    if (this.silence < 2) {
      this.formatMsg(this.msgFormat(...args), 'warn');
    }
  }

  error(...args) {
    if (this.silence <= 3) {
      args.length === 1 && args.push(CODE.error);
      this.formatMsg(this.msgFormat(...args), 'error');
    }
  }

  success(...args) {
    if (this.silence < 3) {
      args.length === 1 && args.push(CODE.success);
      this.formatMsg(this.msgFormat(...args), 'success');
    }
  }

  log(...args) {
    if (this.silence < 1) {
      this.formatMsg(this.msgFormat(...args), 'log');
    }
  }

  loading(msg, timeout = 1000 * 60) {
    this.ora = ora({ stream: process.stdout });
    Loger.tasks.push(this.ora);
    this.ora.start(msg);
    typeof timeout === 'number' && setTimeout(() => {
      Loger.tasks.includes(this.ora) && this.hideLoading('time out');
    }, timeout);
  }

  hideLoading(msg, type, willRebuild = false) {
    const key = types.indexOf(type) > -1 ? type : types[0];
    this.ora[key](msg);
    removeItem(Loger.tasks, this.ora);
    willRebuild && readline.moveCursor(this.ora.stream, 0, -1);
  }
}

Loger.tasks = [];

const CODE = {
  noPage: 'NO_PAGE',
  error: 'ERROR',
  buildFinish: 'BUILD_FINISH',
  buildStart: 'BUILD_START',
};

const loger = new Loger();
function error(msg) {
  loger.error(msg);
}

function warn(msg) {
  loger.warn(msg);
}

module.exports = {
  Loger,
  CODE,
  removeItem,
  error,
  warn,
};
