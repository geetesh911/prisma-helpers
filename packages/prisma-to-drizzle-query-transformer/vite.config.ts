import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  cacheDir:
    '../../node_modules/.vite/packages/prisma-to-drizzle-query-transformer',
  plugins: [],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory:
        '../../coverage/packages/prisma-to-drizzle-query-transformer',
      provider: 'v8',
    },
  },
});
