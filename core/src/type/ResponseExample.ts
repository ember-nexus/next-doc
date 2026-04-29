import type {HttpStatusCode} from "./HttpStatusCode.ts";

export interface ResponseExample {
    httpStatusCode: HttpStatusCode;
    name: string | null;
    description: string;
    body: {
        content: string;
        type: "plain" | "json";
    } | null;
    headers: string;
}