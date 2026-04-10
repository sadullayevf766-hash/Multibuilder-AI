> tsc && vite build
src/lib/supabase.ts(3,33): error TS2339: Property 'env' does not exist on type 'ImportMeta'.
src/lib/supabase.ts(4,37): error TS2339: Property 'env' does not exist on type 'ImportMeta'.
src/main.tsx(2,22): error TS7016: Could not find a declaration file for module 'react-dom/client'. '/opt/render/project/src/node_modules/react-dom/client.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/react-dom` if it exists or add a new declaration (.d.ts) file containing `declare module 'react-dom/client';`
npm error Lifecycle script `build` failed with error:
npm error code 2
npm error path /opt/render/project/src/client
npm error workspace client@1.0.0
npm error location /opt/render/project/src/client
npm error command failed
npm error command sh -c tsc && vite build
==> Build failed 😞
==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys