import { createServer as createViteServer } from 'vite';
import { createApiApp } from './index.mjs';

async function startDev() {
  const apiApp = createApiApp();
  const apiPort = 3001;

  apiApp.listen(apiPort, '0.0.0.0', () => {
    console.log(`✅ [API + SQLite] Running on http://0.0.0.0:${apiPort}`);
  });

  const vite = await createViteServer({
    server: { host: true, port: 5173, allowedHosts: true },
  });
  await vite.listen();
  vite.printUrls();
}

startDev().catch((err) => {
  console.error('Failed to start dev server:', err);
  process.exit(1);
});
