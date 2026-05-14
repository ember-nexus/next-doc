// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import alpinejs from '@astrojs/alpinejs';

import expressiveCode from 'astro-expressive-code';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  },
  server: {
    host: true,
    allowedHosts: ['localhost', 'astro', 'ember-nexus-org-astro']
  },
  site: 'https://soerenklein.dev',
  integrations: [
    expressiveCode(
        {
          themes: ['min-dark', 'min-light'],
        }
    ),
    mdx(),
    sitemap(),
    alpinejs()
  ],
  markdown: {
    shikiConfig: {
      theme: 'min-light',
      langs: [
          "json",
          "text"
      ]
    },
  }
});