import * as path from 'path'
import {defineConfig} from 'vite';

export default defineConfig(({command})=>({
    base: './',
    build: {
        outDir: './docs'
    }
}));
