// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import alpinejs from '@astrojs/alpinejs';

import expressiveCode from 'astro-expressive-code';

import icon from 'astro-icon';
import httpMethodAugmentation from "./src/rehype/httpMethodAugmentation.ts";


export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  },
  server: {
    host: true,
    allowedHosts: ['localhost', 'astro', 'ember-nexus-org-astro']
  },
  site: 'https://api.ember-nexus.dev',
  integrations: [
    expressiveCode(
      {
        themes: ['min-dark', 'min-light'],
        useDarkModeMediaQuery: true,
        defaultProps: {
          frame: 'none',
        }
      }
    ),
    mdx(),
    sitemap(),
    alpinejs(),
    icon(),
    (await import("@playform/compress")).default()
  ],
  markdown: {
    shikiConfig: {
      theme: 'min-light',
      langs: [
          "json",
          "text"
      ]
    },
    rehypePlugins: [httpMethodAugmentation],
  }
});