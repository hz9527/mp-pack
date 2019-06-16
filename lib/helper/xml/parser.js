
class Nodes {
  constructor() {
    this.list = [];
  }

  toString(join = '') {
    return this.list.reduce((str, node) => str + join + node.toString(), '');
  }

  walk(fn) {
    for (let i = 0; i < this.list.length; i++) {
      if (this.list[i]) {
        fn(this.list[i]);
        this.list[i].walk && this.list[i].walk(fn);
      }
    }
  }

  append(node) {
    this.list.push(node);
  }
}
class TagNode {
  constructor(name, parent) {
    this.name = name;
    this.attrs = new Nodes();
    this.children = new Nodes();
    this.parent = parent;
  }

  appendAttr(node) {
    if (node.constructor !== AttrNode) {
      return;
    }
    this.attrs.append(node);
  }

  append(node) {
    this.children.append(node);
  }

  toString() {
    const child = this.children.toString();
    const attr = this.attrs.toString(' ');
    return child === '' ? `<${this.name}${attr} />` : `<${this.name}${attr}>${child}</${this.name}>`; // todo
  }
}
class TextNode {
  constructor(value) {
    if (typeof value === 'string') {
      this.value = value;
      this.children = [];
    } else {
      this.value = null;
      this.children = value;
    }
  }

  append(node) {
    if (this.value !== null) {
      this.children.push(node);
    } else {
      this.children = [new TextNode(this.value), node];
      this.value = null;
    }
  }

  toString() {
    if (this.value === null) {
      return this.children.reduce((str, node) => str + node.toString(), '');
    }
    return this.value;
  }
}

class CommentNode {
  constructor(content) {
    this.value = content;
  }

  toString() {
    return `<!--${this.value}-->`;
  }
}

class AttrNode extends TextNode {
  constructor(name, value) {
    super(value);
    this.name = name;
  }

  toString() {
    const res = super.toString();
    return res ? `${this.name}="${res}"` : this.name;
  }
}

class TemNode {
  constructor(value, valueParser) {
    this.value = value;
    this.valueParser = valueParser;
  }

  toString() {
    return this.value;
  }

  replace(value) {
    this.value = value;
  }
}

class RootNode extends Nodes {
  constructor(parser) {
    super();
    this.expreParser = text => parser(text, TextNode, TemNode);
    // this.hasRootTag = false;
  }
}

function expreParser(text, Text, Tem) {
  const result = [];
  let openInd = text.indexOf('{{');
  let closeInd = text.indexOf('}}');
  let start = 0;
  while (closeInd !== -1 && openInd !== -1) {
    const str = text.slice(start, openInd);
    str && result.push(new Text(str));
    start = closeInd + 2;
    result.push(new Tem(text.slice(openInd, start)));
    openInd = text.indexOf('{{', start);
    closeInd = text.indexOf('}}', start);
  }
  if (result.length > 0 && start < text.length) {
    result.push(new Text(text.slice(start)));
  }
  return result.length > 0 ? result : text;
}

module.exports = {
  TagNode,
  CommentNode,
  TextNode,
  AttrNode,
  TemNode,
  RootNode,
  expreParser,
};
