import equal from "fast-deep-equal/es6";
import type { HarRequest } from "httpsnippet";
import {
  type ContentObject,
  type HeaderObject,
  type OpenAPIObject,
  type OperationObject,
  type PathItemObject,
  type ResponseObject,
  type ResponsesObject,
  type SecuritySchemeObject,
  isReferenceObject,
} from "openapi3-ts/oas31";

import type {
  HttpStatusCode,
  Link,
  RequestHeader,
  ResponseExample,
  ResponseHeader,
} from "../type";

/**
 * Resolve the operation object for a given path + HTTP method.
 *
 * `PathItemObject` keys are typed per method (get/post/...), so indexing with a
 * free-form `method` string requires a narrowing cast.
 */
function getOperation(
  spec: OpenAPIObject,
  path: string,
  method: string,
): OperationObject | undefined {
  const pathItem = spec.paths?.[path];
  return pathItem?.[method as keyof PathItemObject] as
    OperationObject | undefined;
}

export function extractCommonRequestHeaders(
  spec: OpenAPIObject,
  path: string,
  method: string,
): RequestHeader[] {
  const op = getOperation(spec, path, method);

  return (op?.parameters ?? [])
    .filter((p) => !isReferenceObject(p) && p.in === "header")
    .map((p): RequestHeader => {
      // Narrowed above: refs are filtered out, so `p` is a ParameterObject.
      const param = p as Exclude<typeof p, { $ref: string }>;
      return {
        header: param.name,
        presence: param.required ? "required" : "optional",
        description: param.description,
        links: param["x-ember-nexus-links"] as Link[] | undefined,
      };
    });
}

export function extractAuthHeaders(
  spec: OpenAPIObject,
  path: string,
  method: string,
): RequestHeader[] {
  const op = getOperation(spec, path, method);
  const security = op?.security ?? [];
  const schemes = spec.components?.securitySchemes ?? {};

  const isOptional = security.some((req) => Object.keys(req).length === 0);

  return security
    .flatMap((requirement) => Object.keys(requirement))
    .map((name) => schemes[name])
    .filter(
      (scheme): scheme is SecuritySchemeObject =>
        scheme !== undefined &&
        !isReferenceObject(scheme) &&
        scheme.type === "http" &&
        scheme.scheme === "bearer",
    )
    .map((scheme): RequestHeader => ({
      header: "Authorization",
      presence: isOptional ? "optional" : "required",
      description: scheme.description ?? "Bearer token for authentication.",
      links: (scheme["x-ember-nexus-links"] as Link[] | undefined) ?? [],
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
  const op = getOperation(spec, path, method);
  if (!op || !("x-ember-nexus-har-example" in op)) {
    return null;
  }
  return op["x-ember-nexus-har-example"] as Partial<HarRequest>;
}

export function extractResponseHeaders(
  spec: OpenAPIObject,
  path: string,
  method: string,
): ResponseHeader[] {
  const op = getOperation(spec, path, method);
  const merged: { name: string; header: HeaderObject; codes: string[] }[] = [];

  const responses = (op?.responses ?? {}) as ResponsesObject;
  for (const [code, responseOrRef] of Object.entries(responses)) {
    if (isReferenceObject(responseOrRef)) {
      continue;
    }
    const response = responseOrRef as ResponseObject;

    for (const [name, headerOrRef] of Object.entries(response.headers ?? {})) {
      if (isReferenceObject(headerOrRef)) {
        continue;
      }
      const header = headerOrRef;

      const existing = merged.find(
        (entry) => entry.name === name && equal(entry.header, header),
      );
      if (existing) {
        existing.codes.push(code);
      } else {
        merged.push({ name, header, codes: [code] });
      }
    }
  }

  return merged.map(({ name, header }): ResponseHeader => ({
    header: name,
    presence: header.required ? "always" : "optional",
    important:
      (header["x-ember-nexus-important"] as boolean | undefined) ?? false,
    description: header.description ?? "",
    links: (header["x-ember-nexus-links"] as Link[] | undefined) ?? [],
  }));
}

export function extractResponseExamples(
  spec: OpenAPIObject,
  path: string,
  method: string,
): ResponseExample[] {
  const op = getOperation(spec, path, method);
  const results: ResponseExample[] = [];

  const responses = (op?.responses ?? {}) as ResponsesObject;
  for (const [statusCode, responseOrRef] of Object.entries(responses)) {
    if (isReferenceObject(responseOrRef)) {
      continue;
    }
    const response = responseOrRef as ResponseObject;

    const headers = Object.entries(response.headers ?? {})
      .map(([name, headerOrRef]) => {
        let example = "";
        if (!isReferenceObject(headerOrRef)) {
          const headerSchema = headerOrRef.schema;
          if (headerSchema && !isReferenceObject(headerSchema)) {
            example = String(headerSchema.example ?? "");
          }
        }
        return `${name}: ${example}`;
      })
      .join("\n");

    const content: ContentObject = response.content ?? {};
    const links = (response["x-ember-nexus-links"] as Link[] | undefined) ?? [];

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

    for (const [mimeType, mediaType] of Object.entries(content)) {
      const examples = mediaType.examples;
      const schema = mediaType.schema
        ? JSON.stringify(mediaType.schema, null, 2)
        : null;

      if (examples) {
        for (const [, exampleOrRef] of Object.entries(examples)) {
          if (isReferenceObject(exampleOrRef)) {
            continue;
          }
          const example = exampleOrRef;
          results.push({
            httpStatusCode: Number(statusCode) as HttpStatusCode,
            name: (example["x-ember-nexus-name"] as string | undefined) ?? null,
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
