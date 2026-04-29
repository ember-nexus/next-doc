import type {Change, ChangeType} from "../type";
import {getDatabase} from "../db.ts";
import {VARCHAR} from "@duckdb/node-api";

const connection = await getDatabase();

export async function getChangesByVersion(version: string): Promise<Change[]> {
    const resultReader = await connection.runAndReadAll(`
        SELECT version, type, title, features::JSON as features
        FROM changes
        WHERE version = $version
        ORDER BY CASE type
                     WHEN 'add' THEN 1
                     WHEN 'change' THEN 2
                     WHEN 'remove' THEN 3
                     ELSE 4
                     END;
    `, {
        version: version
    });
    const rows = resultReader.getRows();
    return rows.map((row) => {
        const [version, type, title, features] = row as unknown as [string, ChangeType, string, string];
        const parsedFeatures = JSON.parse(features) as unknown as string[];
        return {
            version,
            type,
            title,
            features: parsedFeatures
        };
    });
}

export async function getChangesByFeatureUpToVersion(feature: string, maxVersion: string): Promise<Change[]> {
    const resultReader = await connection.runAndReadAll(`
        WITH max_release AS (
            SELECT release_id AS max_release_id
            FROM versions v
            WHERE v.version = $maxVersion
        )
        SELECT c.version, c.type, c.title, c.features::JSON AS features
        FROM changes c
                 JOIN versions v ON c.version = v.version
                 CROSS JOIN max_release
        WHERE list_contains(features::VARCHAR[], $feature)
          AND v.release_id <= max_release.max_release_id
        ORDER BY v.release_id DESC;
    `, {
        feature: feature,
        maxVersion: maxVersion
    });
    const rows = resultReader.getRows();
    return rows.map((row) => {
        const [version, type, title, features] = row as unknown as [string, ChangeType, string, string];
        const parsedFeatures = JSON.parse(features) as unknown as string[];
        return {
            version,
            type,
            title,
            features: parsedFeatures
        };
    });
}
