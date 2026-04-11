  npm audit fix --force
Run `npm audit` for details.
vite v5.4.21 building for production...
transforming...
✓ 656 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                              0.75 kB │ gzip:   0.43 kB
dist/assets/index-CXuDTvF1.css              24.85 kB │ gzip:   5.47 kB
dist/assets/purify.es-BgtpMKW3.js           22.77 kB │ gzip:   8.79 kB
dist/assets/index.es-Ch0giBOl.js           150.69 kB │ gzip:  51.55 kB
dist/assets/html2canvas.esm-CBrSDip1.js    201.42 kB │ gzip:  48.03 kB
dist/assets/index-BC2IjL99.js            1,112.24 kB │ gzip: 340.53 kB
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 5.01s
> server@1.0.0 build
> tsc
==> Uploading build...
==> Uploaded in 3.7s. Compression took 48.4s
==> Build successful 🎉
==> Deploying...
==> Setting WEB_CONCURRENCY=1 by default, based on available CPUs in the instance
==> Running 'node server/dist/src/index.js'
node:internal/modules/cjs/loader:1386
  throw err;
  ^
Error: Cannot find module '/opt/render/project/src/server/dist/src/index.js'
    at Function._resolveFilename (node:internal/modules/cjs/loader:1383:15)
    at defaultResolveImpl (node:internal/modules/cjs/loader:1025:19)
    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1030:22)
    at Function._load (node:internal/modules/cjs/loader:1192:37)
    at TracingChannel.traceSync (node:diagnostics_channel:328:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:237:24)
Menu
    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:171:5)
    at node:internal/main/run_main_module:36:49 {
  code: 'MODULE_NOT_FOUND',
  requireStack: []
}
Node.js v22.22.0
==> Exited with status 1
==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys