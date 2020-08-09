import * as fs from "fs-extra";
import * as path from "path";
import * as XMLParser from "xml-parser";
import { pascalCase } from "change-case";

let potpack = require("potpack");
if(typeof potpack !== "function" && potpack.default)
    potpack = potpack.default;

function generateAttributes(attributes: XMLParser.Attributes) {
    const keys = Object.keys(attributes);
    if(keys.length === 0) return "";

    return Object.keys(attributes).map(e => ` ${e}="${attributes[e]}"`).join("");
}

function jsNode2xml(indent: string, data: XMLParser.Node) {
    if(data.content && data.children.length)
        throw "invalid node";

    const tagOpen = `<${data.name}${generateAttributes(data.attributes)}>`;
    const tagClose = `</${data.name}>`;

    let content = data.children.length ? data.children.map(e => jsNode2xml(indent + "  ", e)).join("\n") : data.content;
    if(content?.length !== 0)
        content = "\n" + content + "\n" + indent;

    return (
        `${indent}${tagOpen}` +
        `${content}` +
        `${tagClose}`
    );
}

interface SVGFile {
    bounds: {
        /* w & h required for potpack */
        w: number,
        h: number,

        x: number,
        y: number
    },

    name: string,
    data: XMLParser.Document
}

export async function generateSpriteSvg(sprite: GeneratedSprite) {
    let result = "";
    result += `<?xml version="1.0" encoding="utf-8"?>\n`;
    result += `<!-- ${sprite.entries.length} icons packed -->\n`;
    result += `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${sprite.width}" height="${sprite.height}" viewBox="0 0 ${sprite.width} ${sprite.height}">\n`;

    for(const file of sprite.entries) {
        const root = file.data.root;

        delete root.attributes["xmlns"];
        delete root.attributes["xmlns:xlink"];

        root.attributes["id"] = "client-" + file.name; /* appending the "client-" due to legacy reasons */
        root.attributes["x"] = file.bounds.x.toString();
        root.attributes["y"] = file.bounds.y.toString();

        root.attributes["width"] = file.bounds.w.toString();
        root.attributes["height"] = file.bounds.h.toString();

        result += jsNode2xml("  ", root) + "\n";
    }

    result += "</svg>";
    return result;
}

export interface SpriteCssOptions {
    selector: string;
    scale: number;
    unit: "px" | "em";
}

export async function generateSpriteCss(options: SpriteCssOptions, classPrefix: string, sprite: GeneratedSprite, publicUrl: string) {
    const boundsMap = {};
    sprite.entries.forEach(e => {
        const key = e.bounds.w + " " + e.bounds.h;
        boundsMap[key] = (boundsMap[key] | 0) + 1;
    });
    const best = Object.keys(boundsMap).sort((a, b) => boundsMap[b] - boundsMap[a])[0];
    const [ defaultWidth, defaultHeight ] = best.split(" ").map(parseFloat);

    const scaleX = options.unit === "px" ? options.scale : options.scale / defaultWidth;
    const scaleY = options.unit === "px" ? options.scale : options.scale / defaultHeight;

    let result = "";
    result += `${options.selector}{`;
    result +=   `display:inline-block;`;
    result +=   `background:url("${publicUrl}") no-repeat;`;
    result +=   `background-size:${sprite.width * scaleX}${options.unit} ${sprite.height * scaleY}${options.unit};`;
    result +=   `height:${defaultHeight * scaleY}${options.unit};`;
    result +=   `width:${defaultWidth * scaleX}${options.unit}`;
    result += `}`;

    /*
    const unit = (value: number) => {
        let valStr = value.toString();
        if(valStr.length < 5)
            valStr = "     ".substr(valStr.length - 5) + valStr;

        return value === 0 ? `${valStr}  ` : `${valStr}${options.unit}`;
    };
     */
    const unit = (value: number) => {
        let valStr = value.toString();
        return value === 0 ? `${valStr}` : `${valStr}${options.unit}`;
    };
    for(const file of sprite.entries) {
        result += `${options.selector}.${classPrefix}${file.name}{`;
        result +=   `background-position:${unit(-file.bounds.x * scaleX)} ${unit(-file.bounds.y * scaleY)}`;

        if(file.bounds.w !== defaultWidth || file.bounds.h !== defaultHeight) {
            result += ";"; /* from before */
            result += `background-size:${sprite.width * scaleX}${options.unit} ${sprite.height * scaleY}${options.unit};`;
            result += `width:${file.bounds.w * scaleY}${options.unit};`;
            result += `height:${file.bounds.h * scaleX}${options.unit}`;
        }

        result += `}`;
    }

    return result;
}

export interface SpriteDtsOptions {
    module: boolean;
    enumName: string;

    classUnionName: string;
}

function generateEnumMembers(options: SpriteDtsOptions, sprite: GeneratedSprite, cssClassPrefix: string) : { [key: string]: string } {
    const result = {};

    for(const file of sprite.entries) {
        let name = file.name;
        name = name.replace(/[- ]/g, "_")
            .replace(/[^a-zA-Z0-9_]/g, "");
        name = pascalCase(name);

        result[name] = cssClassPrefix + file.name;
    }

    return result;
}
export async function generateSpriteDts(options: SpriteDtsOptions, moduleName: string, sprite: GeneratedSprite, cssClassPrefix: string, modulePrefix: string, sourceDirectory: string) {
    const headerLines = [];
    const lines = [];

    headerLines.push(`/*`);
    headerLines.push(` * DO NOT MODIFY THIS FILE!`);
    headerLines.push(` *`);
    headerLines.push(` * This file has been auto generated by the svg-sprite generator.`);
    headerLines.push(` * Sprite source directory: ${sourceDirectory}`);
    headerLines.push(` * Sprite count: ${sprite.entries.length}`);
    headerLines.push(` */`);
    headerLines.push(``);

    {
        let union = "";
        for(const file of sprite.entries)
            union += ` | "${cssClassPrefix}${file.name}"`;

        lines.push(`export type ${options.classUnionName} = ${union.substr(3)};`);
    }

    lines.push(``);

    {
        lines.push(`export enum ${options.enumName} {`);

        const members = generateEnumMembers(options, sprite, cssClassPrefix);
        for(const key of Object.keys(members))
            lines.push(`  ${key} = "${members[key]}",`);

        lines.push("}");
    }
    //sprite.entries[0].bounds.

    lines.push(``);
    lines.push(`export const spriteEntries: {`);
    lines.push(`  id: string;`);
    lines.push(`  className: string;`);
    lines.push(`  width: number;`);
    lines.push(`  height: number;`);
    lines.push(`  xOffset: number;`);
    lines.push(`  yOffset: number;`);
    lines.push(`}[];`);

    lines.push(``);
    lines.push(`export const spriteUrl: string;`);
    lines.push(`export const classList: string[];`);

    lines.push(``);
    lines.push(`export const spriteWidth: number;`);
    lines.push(`export const spriteHeight: number;`);

    if(options.module) {
        let result = "";
        result += headerLines.join("\n");
        result += `declare module "${modulePrefix}${moduleName}" {\n`;
        result += lines.map(e => "  " + e).join("\n");
        result += `\n}`;
        return result;
    } else {
        return headerLines.join("\n") + lines.join("\n");
    }
}

export async function generateSpriteJs(options: SpriteDtsOptions, sprite: GeneratedSprite, publicUrl: string, cssClassPrefix: string) {
    let lines = [];

    {
        lines.push(`let EnumClassList = {};`);
        const members = generateEnumMembers(options, sprite, cssClassPrefix);
        for(const key of Object.keys(members))
            lines.push(`EnumClassList[EnumClassList["${key}"] = "${members[key]}"] = "${key}";`);
    }

    {
        lines.push(``);
        lines.push(`let SpriteEntries = [`);
        for(const entry of sprite.entries) {
            lines.push(`  Object.freeze({`);
            lines.push(`    id: "${entry.name}",`);
            lines.push(`    className: "${cssClassPrefix}${entry.name}",`);

            lines.push(`    width: ${entry.bounds.w},`);
            lines.push(`    height: ${entry.bounds.h},`);

            lines.push(`    xOffset: ${entry.bounds.x},`);
            lines.push(`    yOffset: ${entry.bounds.y},`);

            lines.push(`  }),`);
        }
        lines.push(`];`);
    }

    lines.push(``);
    lines.push(`let SpriteUrl = decodeURIComponent("${encodeURIComponent(publicUrl)}");`);

    lines.push(``);
    lines.push(`let ClassList = [${sprite.entries.map(e => `"${cssClassPrefix}${e.name}", `)}];`);

    lines.push(``);
    lines.push(`Object.defineProperty(exports, "__esModule", { value: true });`);
    lines.push(`exports.${options.enumName} = Object.freeze(EnumClassList);`);
    lines.push(`exports.spriteUrl = SpriteUrl;`);
    lines.push(`exports.classList = Object.freeze(ClassList);`);
    lines.push(`exports.spriteEntries = Object.freeze(SpriteEntries);`);
    lines.push(`exports.spriteWidth = ${sprite.width};`);
    lines.push(`exports.spriteHeight = ${sprite.height};`);
    return lines.join("\n");
}

export interface GeneratedSprite {
    width: number;
    height: number;

    entries: SVGFile[];
}

export async function generateSprite(files: string[]) : Promise<GeneratedSprite> {
    const result = {
        entries: [],
    } as GeneratedSprite;

    for(const file of files) {
        const svg = {} as SVGFile;

        svg.data = XMLParser((await fs.readFile(file)).toString());
        svg.name = path.basename(file, path.extname(file));

        if(svg.data.root.name !== "svg") {
            console.warn("invalid svg root attribute for " + file + " (" + svg.data.root.name + ")");
            continue;
        }

        const rootAttributes = svg.data.root.attributes;
        const [ xOff, yOff, width, height ] = rootAttributes["viewBox"].split(" ").map(parseFloat);

        if(isNaN(width) || isNaN(height)) {
            console.warn("Skipping SVG %s because of invalid bounds (Parsed: %d x %d, Values: %o).", file, width, height, rootAttributes["viewBox"].split(" "));
            continue;
        }

        svg.bounds = {
            w: width,
            h: height,

            x: undefined,
            y: undefined
        };

        result.entries.push(svg);
    }

    /* take the element height/with divided by two since that's a good number to work with */
    //const svgSpaceWidth = result.elementWidth / 2;
    //const svgSpaceHeight = result.elementHeight / 2;

    //result.entries.forEach(e => { e.bounds.w += svgSpaceWidth; e.bounds.h += svgSpaceHeight });
    const spriteDim = potpack(result.entries.map(e => e.bounds));
    //result.entries.forEach(e => { e.bounds.w -= svgSpaceWidth; e.bounds.h -= svgSpaceHeight });

    result.width = spriteDim.w;
    result.height = spriteDim.h;

    return result;
}