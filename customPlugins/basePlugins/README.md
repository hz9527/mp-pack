# quick start

```js
// packConfig.js
const { resolveNpm, projectReplace, multiple } = require('mp-pack-base-plugins');

// ...
plugins: [
  multiple({env: platform, mobileExt: '_m'})
],
rollupConfig: {
  inputOptions: {
    plugins: [
      resolveNpm({
        'pkgName': function | string // resolveid
      }),
      esmResoler(),
      cjsResoler(),
    ],
  },
},
assets: {
  include: [
    projectFile, // project.config.json
  ],
  plugins: [projectReplace({
    file: projectFile,
    envs: {
      'process.env.APPID': AppId, // can use process.env.APPID in project.config.json
    },
  })],
},
// ...
```

## resolveNpm

> for import some pkg with dynamic file name

for example:

```js
import Pkg from 'pkg/plugins/pkg-miniProduct.1.2.3.min.js'

// dosomething
```

use plugin

```js
// build.js
resolveNpm({
  'pkg'() {
    const mainFile = require.resolve('pkg')
    // find file
    const file = // ...
    return file
  },
  'lib': process.env.MP_ENV === 'wx' ? 'lib/index.wx.js' : 'lib/index.alipay.js'
}),

// app.js
import Pkg from 'pkg'
import Lib from 'lib'

```

can work. once you update pkg, file name maybe change.
and you can use it for import 'dynamic' pkg. some miniprogram pkg maybe for different app (wechat\alipay...)

## projectReplace

> replace env for `project.config.json`

```json
{
  "appid": "Process.env.APPID"
}
```

can dynamic json value. (need't JSON.stringify for value)
you can change `project.config.json` value for different env (ex: oversea)

## multiple

> write once build different

sometime, you develop pc model miniapp & mobile miniapp, logic is same, only xml & css is different. so, you can use this

for different pages/components(use mobile/pc namespace)

```json
{
  "mobile": {
    "pages": []
  },
  "pc": {
    "pages": []
  }
}
```

for same pages/components

```json
{
  "usingComponents": {}
}
```

files

```js
├── app-m.scss
├── app-m.ts
├── app.json
├── app.scss
├── app.ts
├── components
│   ├── head
│   │   ├── head.json
│   │   ├── head.scss
│   │   ├── head.ts
│   │   └── head.ttml
│   └── item
│       ├── item.json
│       ├── item.scss
│       ├── item.ts
│       └── item.ttml
├── pages
│   ├── detail
│   │   ├── detail.scss
│   │   ├── detail.ts
│   │   └── detail.ttml
│   ├── index
│   │   ├── index-m.scss
│   │   ├── index-m.ts
│   │   ├── index-m.ttml
│   │   ├── index.scss
│   │   ├── index.ts
│   │   └── index.ttml
│   └── list
│       ├── list-m.ttml
│       ├── list.scss
│       ├── list.ts
│       ├── list.ttml
│       └── util.ts
└── project.config.json
```
