import type {SidebarItemDto} from "./SidebarItemDto.ts";

export interface SidebarLinkItemDto extends SidebarItemDto{
    type: 'link';
    url: string;
    name: string;
}
