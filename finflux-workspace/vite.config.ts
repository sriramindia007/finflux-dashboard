import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [
        react({
            // Use Babel transforms only for dev HMR; esbuild handles prod
            babel: { babelrc: false, configFile: false },
        })
    ],
    resolve: {
        alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
        port: 5174,
        strictPort: true,
        warmup: {
            // Pre-warm the most-accessed modules so first navigation is instant
            clientFiles: [
                './src/pages/HomeDashboard.tsx',
                './src/pages/CollectionsDashboard.tsx',
                './src/pages/PortfolioDashboard.tsx',
                './src/data/geoDataComplete.ts',
                './src/data/mfiData.ts',
            ],
        },
    },
    build: {
        minify: 'terser',
        terserOptions: {
            compress: { drop_console: true, drop_debugger: true, passes: 2 },
        },
        assetsInlineLimit: 8192,
        chunkSizeWarningLimit: 600,
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-recharts': ['recharts'],
                    'vendor-leaflet': ['leaflet', 'react-leaflet'],
                    'vendor-icons': ['lucide-react'],
                    'vendor-geo': ['./src/data/geoDataComplete.ts'],
                },
            },
        },
    },
    optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom', 'recharts', 'lucide-react',
            // pptxgenjs + jszip MUST be pre-bundled: jszip is CJS and breaks Vite's
            // raw-ESM serving when not converted by esbuild first.
            'pptxgenjs', 'jszip'],
        // html2canvas, jspdf, xlsx are all ESM-compatible — safe to lazy-load
        exclude: ['html2canvas', 'jspdf', 'xlsx'],
    },
})
