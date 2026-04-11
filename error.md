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
✓ built in 4.67s
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
> server@1.0.0 build
> tsc
src/export/__tests__/PdfExporter.test.ts(8,9): error TS2741: Property 'doors' is missing in type '{ id: string; walls: { id: string; start: { x: number; y: number; }; end: { x: number; y: number; }; thickness: number; side: "north"; }[]; fixtures: never[]; pipes: never[]; dimensions: never[]; }' but required in type 'DrawingData'.
src/export/__tests__/PdfExporter.test.ts(53,29): error TS2339: Property 'generateLegend' does not exist on type 'PdfExporter'.
npm error Lifecycle script `build` failed with error:
Menu
npm error code 2
npm error path /opt/render/project/src/server
npm error workspace server@1.0.0
npm error location /opt/render/project/src/server
npm error command failed
npm error command sh -c tsc
==> Build failed 😞
==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys