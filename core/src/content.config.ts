import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const pages = defineCollection({
  loader: glob({ base: "./src/data/pages", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    type: z.string(),
    title: z.string(),
    name: z.string().optional(),
  }),
});

const endpoints = defineCollection({
  loader: glob({ base: "./src/data/endpoints", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    endpoint: z.string(),
    group: z.string(),
    method: z.string(),
    endpointUrl: z.string(),
    swaggerUrl: z.string().optional(),
    name: z.string(),
  }),
});

const commands = defineCollection({
  loader: glob({ base: "./src/data/commands", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    command: z.string(),
    helpCommand: z.string(),
    helpOutput: z.string(),
    exampleCommand: z.string(),
    exampleOutput: z.string(),
  }),
});

export const collections = { pages, endpoints, commands };
