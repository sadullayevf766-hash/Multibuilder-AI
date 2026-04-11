
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
✓ built in 4.95s
> server@1.0.0 build
> tsc
src/index.ts(12,34): error TS1343: The 'import.meta' meta-property is only allowed when the '--module' option is 'es2020', 'es2022', 'esnext', 'system', 'node16', 'node18', 'node20', or 'nodenext'.
npm error Lifecycle script `build` failed with error:
npm error code 2
npm error path /opt/render/project/src/server
npm error workspace server@1.0.0
Menu
npm error location /opt/render/project/src/server
npm error command failed
npm error command sh -c tsc
==> Build failed 😞
==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys