To address all issues (including breaking changes), run:
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
✓ built in 4.50s
> server@1.0.0 build
> tsc
==> Uploading build...
==> Uploaded in 3.6s. Compression took 2.2s
==> Build successful 🎉
==> Deploying...
==> Setting WEB_CONCURRENCY=1 by default, based on available CPUs in the instance
==> Running 'node server/dist/server/src/index.js'
node:internal/modules/esm/resolve:274
    throw new ERR_MODULE_NOT_FOUND(
          ^
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/opt/render/project/src/server/dist/server/src/ai/GeminiParser' imported from /opt/render/project/src/server/dist/server/src/index.js
    at finalizeResolution (node:internal/modules/esm/resolve:274:11)
    at moduleResolve (node:internal/modules/esm/resolve:859:10)
    at defaultResolve (node:internal/modules/esm/resolve:983:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:731:20)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:708:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:310:38)
    at ModuleJob._link (node:internal/modules/esm/module_job:182:49) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///opt/render/project/src/server/dist/server/src/ai/GeminiParser'
}
Node.js v22.22.0
==> Exited with status 1
Menu
==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys