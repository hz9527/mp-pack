# quick start

.babelrc

```json
{
  "plugins": [
    "@babel/plugin-transform-async-to-generator",
    "@babel/plugin-transform-regenerator",
    ["@mp/babel-plugin-import-mp-runtime", {"regeneratorRuntime": true}],
  ]
}
```

app.js

```js
import 'mp-babel-runtime'; // sideEffect for run time. because of mini programe rewrite Function
App({
  // ...
})
```

you can use async & await in you code

> babel can inject runtime for your app. but it need get global, and mini programe hasn't global. so need mp babel runtime

## params

> `@mp/babel-plugin-import-mp-runtime` peer require `mp-babel-runtime`

so params is runtime name. if params is undefined, `@mp/babel-plugin-import-mp-runtime` will use `mp-babel-runtime` all runtime.
