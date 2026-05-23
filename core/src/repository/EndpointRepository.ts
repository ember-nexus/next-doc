import type {Endpoint} from "../type";
import {getDatabase} from "../db.ts";

const connection = await getDatabase();

export async function getEndpointsByVersion(version: string): Promise<Endpoint[]> {
    // return [];
    const resultReader = await connection.runAndReadAll(`
        SELECT e.endpoint, e.method, e.group, e.name, e.endpoint_url
        FROM endpoints e
        WHERE release_version = $version
        ORDER BY e.filename
    `, {
        version: version
    });
    const rows = resultReader.getRows();
    return rows.map((row) => {
        const [endpoint, method, group, name, endpointUrl] = row as unknown as [string, string, string, string, string];
        return {
            endpoint,
            method,
            group,
            name,
            endpointUrl
        };
    });
}
