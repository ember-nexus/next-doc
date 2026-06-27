// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import alpinejs from '@astrojs/alpinejs';

import expressiveCode from 'astro-expressive-code';

import icon from 'astro-icon';
import {httpMethodAugmentation, linkAugmentation} from "./src/rehype";
import pagefind from "astro-pagefind";


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
    expressiveCode(),
    mdx(),
    sitemap(),
    alpinejs(),
    icon(),
    pagefind(),
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
    rehypePlugins: [httpMethodAugmentation, linkAugmentation],
  }
});