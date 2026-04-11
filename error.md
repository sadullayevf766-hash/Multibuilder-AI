==> Cloning from https://github.com/sadullayevf766-hash/Multibuilder-AI
==> Checking out commit 436b4941433966238b6b065b19a798247719c563 in branch main
==> Using Node.js version 22.22.0 (default)
==> Docs on specifying a Node.js version: https://render.com/docs/node-version
==> Running build command 'NODE_ENV=development npm install --prefix client --legacy-peer-deps && NODE_ENV=development npm install --prefix server && client/node_modules/.bin/vite build --root client --outDir dist && npm run build --workspace=server'...
added 177 packages, and audited 178 packages in 13s
28 packages are looking for funding
  run `npm fund` for details
2 moderate severity vulnerabilities
To address all issues (including breaking changes), run:
  npm audit fix --force
Run `npm audit` for details.
added 200 packages, and audited 201 packages in 9s
46 packages are looking for funding
  run `npm fund` for details
4 moderate severity vulnerabilities
To address all issues (including breaking changes), run:
  npm audit fix --force
Run `npm audit` for details.
file:///opt/render/project/src/client/node_modules/vite/dist/node/cli.js:445
          throw new CACError(`Unknown option \`${name.length > 1 ? `--${name}` : `-${name}`}\``);
                ^
CACError: Unknown option `--root`
    at Command.checkUnknownOptions (file:///opt/render/project/src/client/node_modules/vite/dist/node/cli.js:445:17)
Menu
    at CAC.runMatchedCommand (file:///opt/render/project/src/client/node_modules/vite/dist/node/cli.js:643:13)
    at CAC.parse (file:///opt/render/project/src/client/node_modules/vite/dist/node/cli.js:582:12)
    at file:///opt/render/project/src/client/node_modules/vite/dist/node/cli.js:915:5
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:665:26)
Node.js v22.22.0
==> Build failed 😞
==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys