// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import alpinejs from '@astrojs/alpinejs';

import expressiveCode from 'astro-expressive-code';

import icon from 'astro-icon';
import {httpMethodAugmentation, inlineCodeAttrs, linkAugmentation} from "./src/plugins/rehype";
import pagefind from "astro-pagefind";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          // Split the heavy Lit/G6/Vaadin dependency tree into a dedicated
          // vendor chunk.  This chunk is only fetched on pages that actually
          // render <g6-graph> or <json-table> (via the lazy-loader in
          // Default.astro), and is cached across navigations separately from
          // the small per-page JS that every page needs.
          manualChunks(id) {
            if (
              id.includes('/node_modules/@antv/') ||
              id.includes('/node_modules/lit') ||
              id.includes('/node_modules/@lit/') ||
              id.includes('/node_modules/@vaadin/')
            ) {
              return 'vendor-lit-g6';
            }
          },
        },
      },
    },
  },
  build: {
    inlineStylesheets: 'never',
  },
  server: {
    host: true,
    allowedHosts: ['localhost', 'astro', 'ember-nexus-org-astro']
  },
  site: 'https://api.ember-nexus.dev',
  integrations: [
    expressiveCode(),
    mdx(),
    sitemap(),
    alpinejs(),
    icon(),
    pagefind(),
    (await import("@playform/compress")).default({
      CSS: false, // csso + lightningcss break Tailwind's responsive utilities (sm: prefixes)
    })
  ],
  markdown: {
    shikiConfig: {
      theme: 'min-light',
      langs: [
        "json",
        "text"
      ]
    },
    // These are picked up by both pipelines:
    // - @astrojs/mdx reads config.markdown.rehypePlugins via extendMarkdownConfig:true
    // - Astro's legacy migration moves them into the default processor for .md files
    // astro-expressive-code appends its own rehypeExpressiveCode plugin via the same
    // mechanism, so it always runs after our plugins. The deprecation warning about
    // this legacy field is an upstream issue in astro-expressive-code.
    rehypePlugins: [httpMethodAugmentation, linkAugmentation, inlineCodeAttrs],
  }
});
