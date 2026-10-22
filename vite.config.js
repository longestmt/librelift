import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const suite = mode === 'suite';
    const base = suite ? '/lift/' : '/';
    const outDir = suite ? 'dist-suite/lift' : 'dist';

    return {
        base,
        root: '.',
        publicDir: 'public',
        build: {
            outDir,
            emptyOutDir: true,
        },
        plugins: [
            suite && {
                name: 'omit-suite-cname',
                apply: 'build',
                closeBundle: () => rm(resolve(outDir, 'CNAME'), { force: true }),
            },
            VitePWA({
                scope: base,
                registerType: 'autoUpdate',
                includeAssets: ['favicon.svg'],
                manifest: {
                    name: 'LibreLift',
                    short_name: 'LibreLift',
                    description: 'A libre, FLOSS lifting app',
                    theme_color: '#1a1d21',
                    background_color: '#1a1d21',
                    display: 'standalone',
                    id: base,
                    start_url: base,
                    scope: base,
                    icons: [
                        {
                            src: 'favicon.svg',
                            sizes: 'any',
                            type: 'image/svg+xml',
                            purpose: 'any maskable',
                        },
                    ],
                },
                workbox: {
                    navigateFallback: `${base}index.html`,
                    ...(suite ? { cacheId: 'librelift-suite' } : {}),
                    globPatterns: ['**/*.{js,css,html,svg,woff2}'],
                },
            }),
        ].filter(Boolean),
    };
});
