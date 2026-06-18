import { defineCollection, z } from 'astro:content';


import { endpointLoader } from './loaders/endpointLoader';
import {versionLoader} from "./loaders/versionLoader";
import { glob } from 'astro/loaders';

const pages = defineCollection({
    loader: glob({ base: './src/data/pages', pattern: '**/*.{md,mdx}' }),
    schema: z.object({
        type: z.string(),
        title: z.string(),
        name: z.string().optional(),
    }),
});

const endpoints = defineCollection({
    loader: endpointLoader(),
    schema: z.object({
        endpoint: z.string(),
        release_version: z.string(),
        endpoint_version: z.string(),
        version: z.string(),
        group: z.string(),
        method: z.string(),
        endpointUrl: z.string(),
        name: z.string()
    }),
});

const versions = defineCollection({
    loader: versionLoader(),
    schema: z.object({
        release_version: z.string(),
    }),
});

export const collections = { pages, endpoints, versions };
