const htmlparser = require('htmlparser2');
const { TagNode, TextNode, CommentNode, AttrNode, TemNode, expreParser, RootNode } = require('./parser');
class HtmlParser {
  constructor(options = {}) {
    this.expreParser = typeof options.expreParser === 'function' ? options.expreParser : expreParser;
  }

  parse(code) {
    // const root = new RootNode(this.expreParser);
    const stack = [new RootNode(this.expreParser)];
    const parser = new htmlparser.Parser({
      onopentag: (tag, attrs) => {
        const pre = stack[stack.length - 1];
        const cur = new TagNode(tag, pre);
        pre.append(cur);
        const keys = Object.keys(attrs);
        for (let i = 0, l = keys.length; i < l; i++) {
          const key = keys[i];
          cur.attrs.append(new AttrNode(key, this.expreParser(attrs[key], TextNode, TemNode)));
        }
        stack.push(cur);
      },
      ontext: text => {
        stack[stack.length - 1].append(new TextNode(this.expreParser(text, TextNode, TemNode)));
      },
      oncomment(text) {
        stack[stack.length - 1].append(new CommentNode(text));
      },
      onclosetag() {
        stack.pop();
      },
    }, { recognizeSelfClosing: true });
    parser.write(code);
    parser.end();
    return stack.pop();
  }
}

module.exports = HtmlParser;
