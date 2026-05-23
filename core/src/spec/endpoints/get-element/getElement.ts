import type {Endpoint} from "../../contracts";
import {Method, OperationId, SecurityScheme, Tag} from "../../contracts";


export const getElement: Endpoint = {
    path: "/{uuid}",
    method: Method.get,
    summary: "Get Element",
    description: "Retrieves a single element (node or relationship) by UUID.",
    operationId: OperationId.getElement,
    securityScheme: SecurityScheme.optional,
    tags: [Tag.element],
    parameters: [],
    "x-ember-nexus-har-example": {
        "method": "GET",
        "url": "https://api.localhost/74a8fcd9-6cb0-4b0d-8d42-0b6c3c54d1ac",
        "httpVersion": "HTTP/1.1",
        "cookies": [],
        "headers": [
            {
                "name": "Authorization",
                "value": "Bearer secret-token:PIPeJGUt7c00ENn8a5uDlc"
            }
        ],
        "queryString": [],
        "headersSize": -1,
        "bodySize": -1
    },
    responses: []
};
