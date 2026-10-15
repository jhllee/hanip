/* eslint-disable @typescript-eslint/no-require-imports -- 테스트에서 TypeScript 모듈과 의존성을 격리합니다. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
module.exports = function sourceLoader(overrides = {}) {
  const cache = new Map();
  function load(filename) {
    const fullPath = path.resolve(filename);
    if (cache.has(fullPath)) return cache.get(fullPath).exports;
    const loaded = { exports: {} };
    cache.set(fullPath, loaded);
    const code = ts.transpileModule(fs.readFileSync(fullPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    const resolve = (id) => id in overrides ? overrides[id] : id === 'server-only' ? {} : id.startsWith('@/') ? load(path.resolve('src', id.slice(2) + '.ts')) : require(id);
    new Function('require', 'module', 'exports', code)(resolve, loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
};
