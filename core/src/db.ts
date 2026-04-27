import {DuckDBConnection, DuckDBInstance} from "@duckdb/node-api";

let _connection: DuckDBConnection | null = null;

export async function getDatabase(): Promise<DuckDBConnection> {
    if (_connection === null) {
        const _db = await DuckDBInstance.create();
        _connection = await _db.connect();

        await _connection.run("INSTALL yaml FROM community;");
        await _connection.run("LOAD yaml;");
        await _connection.run("SET file_search_path = '/core/src/data';");

        await _connection.run(`
            CREATE OR REPLACE TABLE versions AS
            SELECT ROW_NUMBER() OVER () AS release_id, *
            FROM ((SELECT *
                   FROM 'versions/**/*.yml'
                   ORDER BY
                       CAST (split_part(version, '.', 1) AS INTEGER),
                       CAST (split_part(version, '.', 2) AS INTEGER),
                       CAST (split_part(version, '.', 3) AS INTEGER))
                  UNION ALL
                  SELECT 'dev' AS version,
                         NULL  AS release_date,
                         NULL  AS url);
            ;
        `);

        await _connection.run(`
            CREATE OR REPLACE TABLE raw_endpoints AS
            SELECT *
            FROM read_yaml_frontmatter('endpoints/**/*.mdx', filename:=true)
            ORDER BY endpoint,
                     CASE WHEN version = 'dev' THEN 1 ELSE 0 END,
                     TRY_CAST(split_part(version, '.', 1) AS INTEGER) NULLS FIRST,
                     TRY_CAST(split_part(version, '.', 2) AS INTEGER) NULLS FIRST,
                     TRY_CAST(split_part(version, '.', 3) AS INTEGER) NULLS FIRST;
        `);

        await _connection.run(`
            CREATE OR REPLACE TABLE endpoints AS
            WITH endpoint_releases AS (
                -- Map each endpoint version to its release_id (dev gets NULL, handle separately)
                SELECT
                    e.endpoint,
                    e.version,
                    v.release_id,
                    e.filename
                FROM raw_endpoints e
                         LEFT JOIN versions v ON v.version = e.version
            ),
                 endpoint_version_at_release AS (
                     -- For each endpoint × release combination, find the latest applicable endpoint version
                     SELECT
                         v.release_id,
                         v.version AS release_version,
                         er_distinct.endpoint,
                         MAX(er.release_id) AS applicable_release_id
                     FROM versions v
                              CROSS JOIN (SELECT DISTINCT endpoint FROM raw_endpoints) er_distinct
                              JOIN endpoint_releases er ON er.endpoint = er_distinct.endpoint
                     WHERE er.release_id <= v.release_id
                     GROUP BY v.release_id, v.version, er_distinct.endpoint
                 )
            SELECT
                evr.release_id,
                evr.release_version,
                evr.endpoint,
                er.version AS endpoint_version,
                er.filename AS filename
            FROM endpoint_version_at_release evr
                     JOIN endpoint_releases er
                          ON er.endpoint = evr.endpoint
                              AND er.release_id = evr.applicable_release_id
            ORDER BY evr.endpoint, evr.release_id;
        `);
    }

    return _connection;
}
