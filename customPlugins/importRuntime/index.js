const helperModelImports = require('@babel/helper-module-imports');
const RuntimeSource = 'mp-babel-runtime';
const RuntimeMap = require(RuntimeSource + '/map');

const wm = new WeakMap();

const SupportRuntime = Object.keys(RuntimeMap);
const DefaultRuntime = SupportRuntime.slice();

module.exports = ({ types: t }, params) => {
  const keys = Object.keys(params).reduce((arr, key) => {
    if (SupportRuntime.includes(key)) {
      arr.push(key);
    } else {
      console.warn(`${key} not in SupportRuntime`);
    }
    return arr;
  }, []);
  const runtimes = keys.length ? keys : DefaultRuntime;
  const handler = (runtimeName, callee, path) => {
    if (t.isIdentifier(callee.node.object, { name: runtimeName })) {
      const programPath = path.scope.getProgramParent().path;
      let runtimeId;

      if (wm.has(programPath.node)) {
        runtimeId = t.identifier(wm.get(programPath.node));
      } else {
        runtimeId = helperModelImports.addDefault(programPath, RuntimeSource + RuntimeMap[runtimeName], {
          nameHint: runtimeName,
          importedInterop: 'uncompiled',
          blockHoist: 3,
        });
        wm.set(programPath.node, runtimeId.name);
      }
      callee.node.object.name = runtimeId.name;
    }
  };
  return {
    visitor: {
      CallExpression(path, file) {
        const callee = path.get('callee');

        if (callee.node && callee.node.object && callee.node.property) {
          for (let i = 0, l = runtimes.length; i < l; i++) {
            handler(runtimes[i], callee, path);
          }
        }
      },
    },
  };
};
