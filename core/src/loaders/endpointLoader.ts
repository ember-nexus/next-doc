import type { Loader } from 'astro/loaders';
import { getDatabase } from '../db.ts';

interface EndpointRow {
    endpoint: string;
    release_version: string;
    endpoint_version: string;
    filename: string;
}

export function endpointLoader(): Loader {
    return {
        name: 'endpoint-loader',
        async load({ store, parseData }) {
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
                    filename: filename.replace('/core/src/', './'),
                })
            );

            for (const { endpoint, release_version, endpoint_version, filename } of endpoints) {
                const id = `${release_version}__${endpoint}`.replace(/\//g, '_');

                const data = await parseData({
                    id,
                    data: {
                        endpoint,
                        release_version,
                        endpoint_version,
                        version: release_version, // overwrite MDX frontmatter 'version'
                    },
                });

                store.set({
                    id,
                    data,
                    filePath: filename, // absolute path to .mdx file
                    body: '',
                    rendered: undefined,
                });
            }
        },
    };
}
