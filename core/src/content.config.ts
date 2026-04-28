import { defineCollection, z } from 'astro:content';


import { endpointLoader } from './loaders/endpointLoader';
import {versionLoader} from "./loaders/versionLoader";

const endpoints = defineCollection({
    loader: endpointLoader(),
    schema: z.object({
        endpoint: z.string(),
        release_version: z.string(),
        endpoint_version: z.string(),
        version: z.string(),
    }),
});

const versions = defineCollection({
    loader: versionLoader(),
    schema: z.object({
        release_version: z.string(),
    }),
});

export const collections = { endpoints, versions };
