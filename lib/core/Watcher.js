const chokidar = require('chokidar');
const { EventBus } = require('../utils/utils');

class Watcher {
  constructor() {
    this.chokidar = null;
    this.eventBus = new EventBus(['change', 'addFile', 'removeFile']);
    this.listener = [];
  }

  init(entry) {
    this.chokidar = chokidar.watch(entry, {
      ignoreInitial: true,
    });
    this.chokidar
      .on('add', file => this.eventBus.emit('addFile', file))
      .on('change', file => this.eventBus.emit('change', file))
      .on('unlink', file => this.eventBus.emit('removeFile', file));
  }

  close() {
    this.chokidar.close();
  }
}

module.exports = Watcher;
