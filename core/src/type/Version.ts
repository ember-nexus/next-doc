import type {DateTime} from "luxon";

export interface Version {
    version: string;
    releaseDate: DateTime | null;
    url: string | null;
}
