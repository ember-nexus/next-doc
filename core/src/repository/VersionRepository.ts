import type {Version} from "../type";
import {getDatabase} from "../db.ts";
import {DuckDBTimestampValue} from "@duckdb/node-api";
import {DateTime} from "luxon";

const connection = await getDatabase();

export async function getVersion(version: string): Promise<Version> {
    const resultReader = await connection.runAndReadAll(`
        SELECT release_date, url
        FROM versions
        WHERE version = $version
    `, {
        version: version
    });
    const rows = resultReader.getRows();
    const [releaseDate, url] = rows[0] as unknown as [DuckDBTimestampValue, string];
    return {
        version: version,
        releaseDate: DateTime.fromMillis(Number(releaseDate.micros / 1000n)),
        url: url,
    };
}

export async function getAllVersions(): Promise<Version[]> {
    const resultReader = await connection.runAndReadAll(`
        SELECT version, release_date, url
        FROM versions
        ORDER BY release_id ASC
    `);
    const rows = resultReader.getRows();
    return rows.map((row) => {
        const [version, releaseDate, url] = row as unknown as [string, DuckDBTimestampValue, string];
        return {
            version: version,
            releaseDate: releaseDate !== null ? DateTime.fromMillis(Number(Number(releaseDate?.micros) ?? 0 / 1000n)) : null,
            url: url,
        };
    });
}

export async function getPrevAndNextVersion(version: string): Promise<{
    'prev': string | null,
    'next': string | null
}> {
    const resultReader = await connection.runAndReadAll(`
        SELECT prev_version, next_version
        FROM (SELECT version,
                     LAG(version) OVER () AS prev_version, LEAD(version) OVER () AS next_version
              FROM versions)
        WHERE version = $version;
    `, {
        version: version
    });
    const rows = resultReader.getRows();
    const [prev_version, next_version] = rows[0] as unknown as [string | null, string | null];
    return {
        prev: prev_version,
        next: next_version === 'dev' ? null : next_version
    };
}
