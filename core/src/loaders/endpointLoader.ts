import type { Loader } from 'astro/loaders';
import { getDatabase } from '../db.ts';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

interface EndpointRow {
    endpoint: string;
    release_version: string;
    endpoint_version: string;
    filename: string;
}

export function endpointLoader(): Loader {
    return {
        name: 'endpoint-loader',
        async load({ store, parseData, generateDigest, entryTypes, logger, watcher, config }) {
            const connection = await getDatabase();
            const query = await connection.runAndReadAll(
                'SELECT endpoint, release_version, endpoint_version, filename FROM endpoints;'
            );
            const rows = query.getRows() as unknown as [string, string, string, string][];

            const endpoints: EndpointRow[] = rows.map(
                ([endpoint, release_version, endpoint_version, filename]) => ({
                    endpoint,
                    release_version,
                    endpoint_version,
                    filename,
                })
            );

            // Track which entries are still valid so we can prune stale ones
            const untouchedEntries = new Set(store.keys());
            // Map absolute file path -> id, used by the watcher
            const fileToIdMap = new Map<string, string>();
            // Cache render functions per entry type (mirrors glob loader) [2]
            const renderFunctionByContentType = new WeakMap<object, any>();

            async function syncEndpoint(row: EndpointRow) {
                const { endpoint, release_version, endpoint_version, filename } = row;
                const id = `${release_version}__${endpoint}`.replace(/\//g, '_');

                // 1. Find the entry type by extension (".mdx" -> mdx handler) [2]
                const ext = '.' + filename.split('.').pop();
                const entryType = entryTypes.get(ext);
                if (!entryType) {
                    logger.warn(`No entry type registered for ${ext} (file: ${filename})`);
                    return;
                }

                // 2. Read file contents
                const fileUrl = pathToFileURL(filename);
                const contents = await fs.readFile(fileUrl, 'utf-8').catch((err) => {
                    logger.error(`Error reading ${filename}: ${err.message}`);
                    return undefined;
                });
                if (contents === undefined) return;

                // 3. Let the entry type parse frontmatter + body [2]
                const { body, data: fmData } = await entryType.getEntryInfo({
                    contents,
                    fileUrl,
                });

                untouchedEntries.delete(id);

                const digest = generateDigest(contents);
                const filePath = fileURLToPath(fileUrl);
                const relativePath = path.relative(fileURLToPath(config.root), filePath);

                // 4. Skip work if nothing changed (mirrors glob loader) [2]
                const existingEntry = store.get(id);
                if (existingEntry && existingEntry.digest === digest && existingEntry.filePath) {
                    if (existingEntry.deferredRender) {
                        store.addModuleImport(existingEntry.filePath);
                    }
                    if (existingEntry.assetImports?.length) {
                        store.addAssetImports(existingEntry.assetImports, existingEntry.filePath);
                    }
                    fileToIdMap.set(filePath, id);
                    return;
                }

                // 5. Merge DB fields onto frontmatter, then validate via schema
                const parsedData = await parseData({
                    id,
                    data: {
                        ...fmData,
                        endpoint,
                        release_version,
                        endpoint_version,
                        version: release_version, // overwrite MDX frontmatter 'version'
                    },
                    filePath,
                });

                // 6. Branch on entry type capabilities [2]
                if (entryType.getRenderFunction) {
                    // Markdown path: render to HTML now and store it
                    let render = renderFunctionByContentType.get(entryType);
                    if (!render) {
                        render = await entryType.getRenderFunction(config);
                        renderFunctionByContentType.set(entryType, render);
                    }
                    let rendered;
                    try {
                        rendered = await render?.({ id, data: parsedData, body, filePath, digest });
                    } catch (err: any) {
                        logger.error(`Error rendering ${filename}: ${err.message}`);
                    }
                    store.set({
                        id,
                        data: parsedData,
                        body,
                        filePath: relativePath,
                        digest,
                        rendered,
                        assetImports: rendered?.metadata?.imagePaths,
                    });
                } else if ('contentModuleTypes' in entryType) {
                    // MDX path: defer rendering — Astro will import filePath through Vite/MDX
                    store.set({
                        id,
                        data: parsedData,
                        body,
                        filePath: relativePath,
                        digest,
                        deferredRender: true,
                    });
                } else {
                    // Fallback: data-only entry
                    store.set({
                        id,
                        data: parsedData,
                        body,
                        filePath: relativePath,
                        digest,
                    });
                }

                fileToIdMap.set(filePath, id);
            }

            // Initial load
            for (const row of endpoints) {
                await syncEndpoint(row);
            }

            // Prune entries that no longer exist in the DB
            untouchedEntries.forEach((id) => store.delete(id));

            // 7. Optional: HMR — watch the .mdx files for edits [2]
            if (watcher) {
                for (const { filename } of endpoints) {
                    watcher.add(filename);
                }
                const onChange = async (changedPath: string) => {
                    const row = endpoints.find((r) => r.filename === changedPath);
                    if (!row) return;
                    await syncEndpoint(row);
                    logger.info(`Reloaded data from ${changedPath}`);
                };
                watcher.on('change', onChange);
                watcher.on('add', onChange);
            }
        },
    };
}