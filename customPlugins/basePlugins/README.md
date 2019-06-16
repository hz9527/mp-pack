# quick start

```js
// packConfig.js
const { resolveNpm, projectReplace } = require('@bdeefe/mp-pack-base-plugins');

// ...

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
