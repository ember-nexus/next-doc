import type { OpenAPIObject } from 'openapi3-ts/oas31';
import type {ResponseExample, Link, HttpStatusCode, ResponseHeader, RequestHeader} from "../type";
import equal from "fast-deep-equal/es6";
import type {HarRequest} from "httpsnippet";





export function extractCommonRequestHeaders(spec: OpenAPIObject, path: string, method: string): RequestHeader[] {
    const op = (spec.paths?.[path] as any)?.[method];

    return (op?.parameters ?? [])
        .filter((p: any) => p.in === 'header')
        .map(({name, required, description, 'x-ember-nexus-links': links}: any): RequestHeader => ({
            header: name,
            presence: required ? 'required' : 'optional',
            description,
            links,
        }));
}

export function extractAuthHeaders(spec: OpenAPIObject, path: string, method: string): RequestHeader[] {
    const op = (spec.paths?.[path] as any)?.[method];
    const security: Record<string, string[]>[] = op?.security ?? [];
    const schemes = (spec as any).components?.securitySchemes ?? {};

    const isOptional = security.some((req) => Object.keys(req).length === 0);

    return security
        .flatMap(Object.keys)
        .filter((name) => schemes[name]?.type === 'http' && schemes[name]?.scheme === 'bearer')
        .map((name): RequestHeader => ({
            header: 'Authorization',
            presence: isOptional ? 'optional' : 'required',
            description: schemes[name].description ?? 'Bearer token for authentication.',
            links: schemes[name]['x-ember-nexus-links'] ?? [],
        }));
}

export function extractRequestHeaders(spec: OpenAPIObject, path: string, method: string): RequestHeader[]
{
    return [
        ...extractAuthHeaders(spec, path, method),
        ...extractCommonRequestHeaders(spec, path, method),
    ];
}





export function extractHarExample(spec: OpenAPIObject, path: string, method: string): null|Partial<HarRequest> {
    const op = (spec.paths?.[path] as any)?.[method];
    if (!("x-ember-nexus-har-example" in op)) {
        return null;
    }
    return op["x-ember-nexus-har-example"] satisfies Partial<HarRequest>;
}

export function extractResponseHeaders(spec: OpenAPIObject, path: string, method: string): ResponseHeader[] {
    const op = (spec.paths?.[path] as any)?.[method];
    const merged: { name: string; schema: any; codes: string[] }[] = [];

    for (const [code, res] of Object.entries(op?.responses ?? {}) as any) {
        for (const [name, schema] of Object.entries((res as any)?.headers ?? {}) as any) {
            const existing = merged.find((r) => r.name === name && equal(r.schema, schema));
            if (existing) {
                existing.codes.push(code);
            } else {
                merged.push({name, schema, codes: [code]});
            }
        }
    }

    return merged.map(({name, schema}) => ({
        header: name,
        presence: schema.required ? 'always' : 'optional',
        important: schema['x-ember-nexus-important'] as boolean ?? false,
        description: schema.description as string,
        links: schema['x-ember-nexus-links'] as Link[],
    } satisfies ResponseHeader));
}

export function extractResponseExamples(
    spec: OpenAPIObject,
    path: string,
    method: string
): ResponseExample[] {
    const op = (spec.paths?.[path] as any)?.[method];
    const results: ResponseExample[] = [];

    for (const [statusCode, response] of Object.entries(op?.responses ?? {}) as any) {
        const headers = Object.entries(response?.headers ?? {})
            .map(([name, schema]: any) => `${name}: ${schema.schema?.example ?? ''}`)
            .join('\n');

        const content = response?.content ?? {};
        const links: Link[] = response['x-ember-nexus-links'] ?? [];

        if (Object.keys(content).length === 0) {
            results.push({
                httpStatusCode: Number(statusCode) as HttpStatusCode,
                name: null,
                description: response.description ?? '',
                links,
                body: null,
                headers,
                schema: null
            });
            continue;
        }

        for (const [mimeType, mediaType] of Object.entries(content) as any) {
            const examples = mediaType?.examples;
            const schema = mediaType?.schema
                ? JSON.stringify(mediaType.schema, null, 2)
                : null;

            if (examples) {
                for (const [, example] of Object.entries(examples) as any) {
                    results.push({
                        httpStatusCode: Number(statusCode) as HttpStatusCode,
                        name: example['x-ember-nexus-name'] ?? null,
                        description: example.summary ?? response.description ?? '',
                        links,
                        body: {
                            content: JSON.stringify(example.value, null, 2),
                            type: mimeType.includes('json') ? 'json' : 'plain',
                        },
                        headers,
                        schema,
                    });
                }
            } else {
                results.push({
                    httpStatusCode: Number(statusCode) as HttpStatusCode,
                    name: null,
                    description: response.description ?? '',
                    links,
                    body: null,
                    headers,
                    schema,
                });
            }
        }
    }

    return results;
}