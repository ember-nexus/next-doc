import type { Loader } from 'astro/loaders';
import { getDatabase } from '../db.ts';

export function versionLoader(): Loader {
    return {
        name: 'version-loader',
        async load({ store, parseData }) {
            const connection = await getDatabase();
            const query = await connection.runAndReadAll(`
                SELECT version AS release_version
                FROM versions
                WHERE version != 'dev'
                ORDER BY release_id DESC;
            `);
            const rows = query.getRows() as unknown as [string][];

            const untouchedEntries = new Set(store.keys());

            for (const [release_version] of rows) {
                untouchedEntries.delete(release_version);

                const parsedData = await parseData({
                    id: release_version,
                    data: { release_version },
                });

                store.set({ id: release_version, data: parsedData });
            }

            untouchedEntries.forEach((id) => store.delete(id));
        },
    };
}
