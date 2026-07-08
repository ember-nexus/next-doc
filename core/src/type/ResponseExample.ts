import type { HttpStatusCode } from "./HttpStatusCode.ts";
import type { Link } from "./Link.ts";

export interface ResponseExample {
  httpStatusCode: HttpStatusCode;
  name: string | null;
  description: string;
  links: Link[];
  body:
    | {
        content: string;
        type: "plain" | "json";
      }
    | {
        type: "binary";
      }
    | null;
  headers: string;
  schema: string | null;
}
