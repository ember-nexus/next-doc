import { defineCollection, z } from 'astro:content';


import { endpointLoader } from './loaders/endpointLoader';

const endpoints = defineCollection({
    loader: endpointLoader(),
    schema: z.object({
        endpoint: z.string(),
        release_version: z.string(),
        endpoint_version: z.string(),
        version: z.string(),
    }),
});

export const collections = { endpoints };
