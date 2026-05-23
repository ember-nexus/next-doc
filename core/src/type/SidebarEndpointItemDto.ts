import type {SidebarItemDto} from "./SidebarItemDto.ts";
import type {HttpMethod} from "./HttpMethod.ts";

export interface SidebarEndpointItemDto extends SidebarItemDto
{
    type: 'endpoint';
    url: string;
    name: string;
    method: HttpMethod,
    endpointUrl: string
}
