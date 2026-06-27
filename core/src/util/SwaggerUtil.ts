import equal from "fast-deep-equal/es6";
import type { HarRequest } from "httpsnippet";
import type { OpenAPIObject } from "openapi3-ts/oas31";

import type {
  HttpStatusCode,
  Link,
  RequestHeader,
  ResponseExample,
  ResponseHeader,
} from "../type";

export function extractCommonRequestHeaders(
  spec: OpenAPIObject,
  path: string,
  method: string,
): RequestHeader[] {
  const op = (spec.paths?.[path] as unknown)?.[method];

  return (op?.parameters ?? [])
    .filter((p: unknown) => p.in === "header")
    .map(
      ({
        name,
        required,
        description,
        "x-ember-nexus-links": links,
      }: unknown): RequestHeader => ({
        header: name,
        presence: required ? "required" : "optional",
        description,
        links,
      }),
    );
}

export function extractAuthHeaders(
  spec: OpenAPIObject,
  path: string,
  method: string,
): RequestHeader[] {
  const op = (spec.paths?.[path] as unknown)?.[method];
  const security: Record<string, string[]>[] = op?.security ?? [];
  const schemes = (spec as unknown).components?.securitySchemes ?? {};

  const isOptional = security.some((req) => Object.keys(req).length === 0);

  return security
    .flatMap(Object.keys)
    .filter(
      (name) =>
        schemes[name]?.type === "http" && schemes[name]?.scheme === "bearer",
    )
    .map((name): RequestHeader => ({
      header: "Authorization",
      presence: isOptional ? "optional" : "required",
      description:
        schemes[name].description ?? "Bearer token for authentication.",
      links: schemes[name]["x-ember-nexus-links"] ?? [],
    }));
}

export function extractRequestHeaders(
  spec: OpenAPIObject,
  path: string,
  method: string,
): RequestHeader[] {
  return [
    ...extractAuthHeaders(spec, path, method),
    ...extractCommonRequestHeaders(spec, path, method),
  ];
}

export function extractHarExample(
  spec: OpenAPIObject,
  path: string,
  method: string,
): null | Partial<HarRequest> {
  const op = (spec.paths?.[path] as unknown)?.[method];
  if (!("x-ember-nexus-har-example" in op)) {
    return null;
  }
  return op["x-ember-nexus-har-example"] satisfies Partial<HarRequest>;
}

export function extractResponseHeaders(
  spec: OpenAPIObject,
  path: string,
  method: string,
): ResponseHeader[] {
  const op = (spec.paths?.[path] as unknown)?.[method];
  const merged: { name: string; schema: unknown; codes: string[] }[] = [];

  for (const [code, res] of Object.entries(op?.responses ?? {}) as unknown) {
    for (const [name, schema] of Object.entries(
      (res as unknown)?.headers ?? {},
    ) as unknown) {
      const existing = merged.find(
        (r) => r.name === name && equal(r.schema, schema),
      );
      if (existing) {
        existing.codes.push(code);
      } else {
        merged.push({ name, schema, codes: [code] });
      }
    }
  }

  return merged.map(
    ({ name, schema }) =>
      ({
        header: name,
        presence: schema.required ? "always" : "optional",
        important: (schema["x-ember-nexus-important"] as boolean) ?? false,
        description: schema.description as string,
        links: schema["x-ember-nexus-links"] as Link[],
      }) satisfies ResponseHeader,
  );
}

export function extractResponseExamples(
  spec: OpenAPIObject,
  path: string,
  method: string,
): ResponseExample[] {
  const op = (spec.paths?.[path] as unknown)?.[method];
  const results: ResponseExample[] = [];

  for (const [statusCode, response] of Object.entries(
    op?.responses ?? {},
  ) as unknown) {
    const headers = Object.entries(response?.headers ?? {})
      .map(
        ([name, schema]: unknown) => `${name}: ${schema.schema?.example ?? ""}`,
      )
      .join("\n");

    const content = response?.content ?? {};
    const links: Link[] = response["x-ember-nexus-links"] ?? [];

    if (Object.keys(content).length === 0) {
      results.push({
        httpStatusCode: Number(statusCode) as HttpStatusCode,
        name: null,
        description: response.description ?? "",
        links,
        body: null,
        headers,
        schema: null,
      });
      continue;
    }

    for (const [mimeType, mediaType] of Object.entries(content) as unknown) {
      const examples = mediaType?.examples;
      const schema = mediaType?.schema
        ? JSON.stringify(mediaType.schema, null, 2)
        : null;

      if (examples) {
        for (const [, example] of Object.entries(examples) as unknown) {
          results.push({
            httpStatusCode: Number(statusCode) as HttpStatusCode,
            name: example["x-ember-nexus-name"] ?? null,
            description: example.summary ?? response.description ?? "",
            links,
            body: {
              content: JSON.stringify(example.value, null, 2),
              type: mimeType.includes("json") ? "json" : "plain",
            },
            headers,
            schema,
          });
        }
      } else {
        results.push({
          httpStatusCode: Number(statusCode) as HttpStatusCode,
          name: null,
          description: response.description ?? "",
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
