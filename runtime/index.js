/* eslint-disable no-global-assign */
// sideEffect for runtime
const GlobalFn = Function;
Function = function _Function(...args) {
  const result = this instanceof _Function ? new GlobalFn(...args) : GlobalFn(...args);
  return typeof result === 'function' ? result : GlobalFn;
};
