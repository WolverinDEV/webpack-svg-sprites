import * as Generator from "./Generator";
import { SpriteGenerator, Options as PluginOptions } from "./Plugin";

export type Sprite = Generator.GeneratedSprite;
export type DtsOptions = Generator.SpriteDtsOptions;
export type CssOptions = Generator.SpriteCssOptions;

export type Options = PluginOptions;
export const Plugin = SpriteGenerator;