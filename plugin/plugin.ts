import * as path from "path";
import * as SystemFs from "fs-extra";
import sha1 from "sha1";
import webpack, {Compiler, Module, RuntimeGlobals} from "webpack";

import {
    GeneratedSprite,
    generateSprite,
    generateSpriteCss, generateSpriteDts, generateSpriteJs,
    generateSpriteSvg,
    SpriteCssOptions,
    SpriteDtsOptions
} from "./generator";
import Compilation = webpack.Compilation;

const { RawSource } = require("webpack-sources");

export interface Options {
    modulePrefix?: string, /* defaults to svg-sprites/ */
    dtsOutputFolder: string,
    configurations: {
        [key: string] : SvgSpriteConfiguration
    },
    publicPath?: string,
}


interface SvgSpriteConfiguration {
    folder: string;
    cssClassPrefix: string;

    dtsOptions: SpriteDtsOptions;
    cssOptions: SpriteCssOptions[];
}

const TYPES = new Set(["javascript"]);
const RUNTIME_REQUIREMENTS = new Set([
    RuntimeGlobals.module
]);

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
        super("javascript/dynamic", null);
        this.pluginConfig = pluginConfig;
        this.configName = configName;
        this.config = config;
        this.buildInfo = {};
        this.clearDependenciesAndBlocks();
    }

    getSourceTypes() {
        return TYPES;
    }

    identifier() {
        return this.pluginConfig.modulePrefix + this.configName;
    }

    readableIdentifier() {
        return `SVG sprite ` + this.configName;
    }

    libIdent() {
        return this.pluginConfig.modulePrefix + this.configName;
    }

    needBuild(context, callback) {
        context.fileSystemInfo.getContextHash(this.config.folder, (error, hash) => {
            if(error) {
                callback(error);
                return;
            }

            const needBuild = this.buildMeta?.directoryHash !== hash;
            callback(null, needBuild);
        })
    }

    build(options, compilation: Compilation, resolver, fs, callback) {
        this.buildAsync(options, compilation).then(() => {
            callback();
        }).catch(error => {
            callback(error);
        });
    }

    private async buildAsync(options_, compilation: Compilation) {
        this.buildMeta = {
            async: false,
            exportsType: undefined
        };

        this.buildInfo = {
            cacheable: true,
            assets: {},
        };

        if(this.spriteAssetName) {
            delete compilation.assets[this.spriteAssetName];
        }

        this.buildMeta.directoryHash = await new Promise((resolve, reject) => {
            compilation.fileSystemInfo.getContextHash(this.config.folder, (err, hash) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(hash);
                }
            });
        });
        compilation.logger.info("Building SVG sprite for configuration %s (Hash: %s).", this.configName, this.buildMeta.directoryHash);

        const files = await SystemFs.readdir(this.config.folder);
        this.sprite = await generateSprite(files.map(file => path.join(this.config.folder, file)));

        this.spriteSvg = await generateSpriteSvg(this.sprite);
        this.spriteAssetName = "sprite-" + sha1(this.spriteSvg).substr(-20) + ".svg";
        this.spriteAssetUrl = (this.pluginConfig.publicPath || "") + this.spriteAssetName;

        this.buildInfo.assets[this.spriteAssetName] = new RawSource(this.spriteSvg);

        this.spriteCss = "";
        for(const cssOption of this.config.cssOptions) {
            this.spriteCss += await generateSpriteCss(cssOption, this.config.cssClassPrefix, this.sprite, this.spriteAssetUrl);
        }

        this.spriteJs = await generateSpriteJs(this.config.dtsOptions, this.sprite, this.spriteAssetUrl, this.config.cssClassPrefix);

        const dtsContent = await generateSpriteDts(this.config.dtsOptions, this.configName, this.sprite, this.config.cssClassPrefix, this.pluginConfig.modulePrefix, this.config.folder);
        await SystemFs.writeFile(path.join(this.pluginConfig.dtsOutputFolder, this.configName + ".d.ts"), dtsContent);
        compilation.logger.info("SVG sprite configuration %s contains %d/%d sprites", this.configName, this.sprite.entries.length, files.length);
    }

    codeGeneration(context) {
        const sources = new Map();

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

        sources.set("javascript", new RawSource(lines.join("\n")));
        return { sources: sources, runtimeRequirements: RUNTIME_REQUIREMENTS };
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

    addReason(_requestModule, _dependency) { }

    addCacheDependencies(
        fileDependencies,
        contextDependencies,
        missingDependencies,
        buildDependencies
    ) {
        contextDependencies.add(this.config.folder);
    }
}


export class SpriteGenerator {
    readonly options: Options;
    constructor(options: Options) {
        this.options = options || {} as any;
        this.options.configurations = this.options.configurations || {};
        this.options.modulePrefix = this.options.modulePrefix || "svg-sprites/";
    }

    apply(compiler: Compiler) {
        compiler.hooks.normalModuleFactory.tap("SpriteGenerator", normalModuleFactory => {
            normalModuleFactory.hooks.resolve.tap("SpriteGenerator", resolveData => {
                if(!resolveData.request.startsWith(this.options.modulePrefix)) {
                    return;
                }

                const configName = resolveData.request.substr(this.options.modulePrefix.length);
                if(!this.options.configurations[configName]) {
                    return;
                }

                return new SvgSpriteModule(resolveData.request, this.options, configName, this.options.configurations[configName]);
            });
        });
    }
}