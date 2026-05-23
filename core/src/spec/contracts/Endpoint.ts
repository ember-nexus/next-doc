import type {Method} from "./Method.ts";
import type {OperationId} from "./OperationId.ts";
import type {SecurityScheme} from "./SecurityScheme.ts";
import type {HarRequest} from "httpsnippet";
import type {Tag} from "./Tag.ts";


export type Endpoint = {
    path: string,
    method: Method,
    summary: string,
    description: string,
    operationId: OperationId,
    securityScheme: SecurityScheme,
    tags: Tag[],
    parameters: any[],
    "x-ember-nexus-har-example": Partial<HarRequest>,
    responses: any[]
};
