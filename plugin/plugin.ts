import * as webpack from "webpack";
import * as path from "path";
import * as fs from "fs-extra";
import * as sha1 from "sha1";

import {
    GeneratedSprite,
    generateSprite,
    generateSpriteCss, generateSpriteDts, generateSpriteJs,
    generateSpriteSvg,
    SpriteCssOptions,
    SpriteDtsOptions
} from "./generator";

export interface Options {
    modulePrefix?: string, /* defaults to svg-sprites/ */
    dtsOutputFolder: string,
    configurations: {
        [key: string] : SvgSpriteConfiguration
    }
}

const Module = require("webpack/lib/Module");
const { RawSource } = require("webpack-sources");

interface SvgSpriteConfiguration {
    folder: string;
    cssClassPrefix: string;

    dtsOptions: SpriteDtsOptions;
    cssOptions: SpriteCssOptions[];
}

class SvgSpriteModule extends Module {
    private readonly pluginConfig: Options;
    private readonly configName: string;
    private readonly config: SvgSpriteConfiguration;
    private sprite: GeneratedSprite;
    private spriteSvg: string;
    private spriteCss: string;
    private spriteJs: string;
    private spriteAssetName: string;
    private spriteAssetUrl: string;

    constructor(context: string, pluginConfig: Options, configName: string, config: SvgSpriteConfiguration) {
        super("javascript/dynamic", context);
        this.pluginConfig = pluginConfig;
        this.configName = configName;
        this.config = config;
    }

    identifier() {
        return `SVG sprite ` + this.configName;
    }

    readableIdentifier(requestShortener) {
        return `SVG sprite ` + this.configName;
    }

    needRebuild() {
        return false;
    }

    build(options, compilation, resolver, fs_, callback) {
        console.info("Building SVG sprite for configuration %s", this.configName);

        this.built = true;
        this.buildMeta = {
            async: false,
            exportsType: undefined
        };
        this.buildInfo = {};

        if(this.spriteAssetName) {
            delete compilation.assets[this.spriteAssetName];
        }

        (async () => {
            const files = (await fs.readdir(this.config.folder)).map(e => path.join(this.config.folder, e));
            this.sprite = await generateSprite(files);

            this.spriteSvg = await generateSpriteSvg(this.sprite);
            this.spriteAssetName = "sprite-" + sha1(this.spriteSvg).substr(-20) + ".svg";
            this.spriteAssetUrl = (compilation.options.output.publicPath || "") + this.spriteAssetName;

            compilation.assets[this.spriteAssetName] = new RawSource(this.spriteSvg);

            this.spriteCss = "";
            for(const cssOption of this.config.cssOptions) {
                this.spriteCss += await generateSpriteCss(cssOption, this.config.cssClassPrefix, this.sprite, this.spriteAssetUrl);
            }

            this.spriteJs = await generateSpriteJs(this.config.dtsOptions, this.sprite, this.spriteAssetUrl, this.config.cssClassPrefix);

            const dtsContent = await generateSpriteDts(this.config.dtsOptions, this.configName, this.sprite, this.config.cssClassPrefix, this.pluginConfig.modulePrefix, this.config.folder);
            await fs.writeFile(path.join(this.pluginConfig.dtsOutputFolder, this.configName + ".d.ts"), dtsContent);
        })().then(() => {
            callback();
        }).catch(error => {
            console.error(error);
            callback("failed to generate sprite");
        });
    }

    source() {
        const encodedCss = this.spriteCss
                                .replace(/%/g, "%25")
                                .replace(/"/g, "%22")
                                .replace(/\n/g, "%0A");

        let lines = [];
        lines.push(`/* initialize css */`);
        lines.push(`var element = document.createElement("style");`);
        lines.push(`element.innerText = decodeURIComponent("${encodedCss}");`);
        lines.push(`document.head.append(element);`);
        lines.push(``);
        lines.push(`/* initialize typescript objects */`);
        lines.push(...this.spriteJs.split("\n"));
        return new RawSource(lines.join("\n"));
    }

    size() {
        return 12;
    }

    updateHash(hash, chunkGraph) {
        hash.update("svg-sprite module");
        hash.update(this.configName || "none");
        hash.update(this.spriteCss || "none");
        hash.update(this.spriteSvg || "none");
        super.updateHash(hash, chunkGraph);
    }
}

export class SpriteGenerator {
    readonly options: Options;
    constructor(options: Options) {
        this.options = options || {} as any;
        this.options.configurations = this.options.configurations || {};
        this.options.modulePrefix = this.options.modulePrefix || "svg-sprites/";
    }

    apply(compiler: webpack.Compiler) {
        compiler.hooks.thisCompilation.tap("SpriteGenerator", (compilation, { normalModuleFactory }) => {
            normalModuleFactory.hooks.factory.tap("SpriteGenerator", factory => (data, callback) => {
                if(data.request.startsWith(this.options.modulePrefix)) {
                    const configName = data.request.substr(this.options.modulePrefix.length);
                    if(this.options.configurations[configName] === undefined) {
                        callback("Missing SVG configuration " + configName);
                        return;
                    }
                    callback(null, new SvgSpriteModule(data.request, this.options, configName, this.options.configurations[configName]));
                    return;
                }

                factory(data, callback);
            });
        });
    }
}