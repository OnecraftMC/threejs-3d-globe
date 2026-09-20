// Vite — bundel tiga + kode sumber menjadi satu aplikasi statis.
import { defineConfig } from 'vite';

export default defineConfig({
  // Path RELATIF supaya hasil build tetap jalan bila dibuka dari subfolder
  // (mis. disalin ke Google Drive atau hosting apa pun), bukan hanya dari /.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    // Tekstur tetap sebagai berkas terpisah di textures/ (lebih ramah cache
    // dan tidak menggembungkan berkas JS).
    assetsInlineLimit: 0,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  publicDir: 'public',
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});
