// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import alpinejs from '@astrojs/alpinejs';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  },
  server: {
    host: true,
    allowedHosts: ['localhost', 'astro', 'ember-nexus-org-astro']
  },
  site: 'https://soerenklein.dev',
  integrations: [mdx(), sitemap(), alpinejs()],
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