declare module "svg-sprites/test" {
  export type TestIconClasses = "client-about" | "client-activate_microphone" | "client-add" | "client-add_foe" | "client-add_folder" | "client-add_friend" | "client-addon-collection" | "client-addon" | "client-apply" | "client-arrow_down" | "client-arrow_left" | "client-arrow_right" | "client-arrow_up" | "client-away" | "client-ban_client" | "client-ban_list" | "client-bookmark_add" | "client-bookmark_add_folder" | "client-bookmark_duplicate" | "client-w2g";
  
  export enum TestIcons {
    About = "client-about",
    ActivateMicrophone = "client-activate_microphone",
    Add = "client-add",
    AddFoe = "client-add_foe",
    AddFolder = "client-add_folder",
    AddFriend = "client-add_friend",
    AddonCollection = "client-addon-collection",
    Addon = "client-addon",
    Apply = "client-apply",
    ArrowDown = "client-arrow_down",
    ArrowLeft = "client-arrow_left",
    ArrowRight = "client-arrow_right",
    ArrowUp = "client-arrow_up",
    Away = "client-away",
    BanClient = "client-ban_client",
    BanList = "client-ban_list",
    BookmarkAdd = "client-bookmark_add",
    BookmarkAddFolder = "client-bookmark_add_folder",
    BookmarkDuplicate = "client-bookmark_duplicate",
    W2g = "client-w2g",
  }
  
  export const spriteEntries: {
    id: string;
    className: string;
    width: number;
    height: number;
    xOffset: number;
    yOffset: number;
  }[];
  
  export const spriteUrl: string;
  export const classList: string[];
  
  export const spriteWidth: number;
  export const spriteHeight: number;
}