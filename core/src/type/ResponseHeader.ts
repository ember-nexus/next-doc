import type { Link } from "./Link.js";

export interface ResponseHeader {
  header: string;
  presence: "optional" | "always";
  important: boolean;
  description: string;
  links: Link[];
}
