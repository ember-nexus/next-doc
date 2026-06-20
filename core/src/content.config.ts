import { defineCollection, z } from 'astro:content';


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
    loader: glob({ base: './src/data/endpoints', pattern: '**/*.{md,mdx}' }),
    schema: z.object({
        endpoint: z.string(),
        group: z.string(),
        method: z.string(),
        endpointUrl: z.string(),
        name: z.string()
    }),
});


export const collections = { pages, endpoints };
