import type {SidebarItemDto} from "./SidebarItemDto.ts";

export interface SidebarGroupItemDto extends SidebarItemDto {
    type: 'group';
    name: string;
    items: SidebarItemDto[]
}
