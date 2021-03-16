import * as path from "path";
import {Configuration} from "webpack";
import {CleanWebpackPlugin} from "clean-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import * as SpriteGenerator from "../plugin/";

export = {
    entry: path.join(__dirname, "app", "index.tsx"),
    target: "web",

    plugins: [
        new CleanWebpackPlugin(),
        new SpriteGenerator.Plugin({
            dtsOutputFolder: path.join(__dirname, "app"),
            configurations: {
                test: {
                    folder: path.join(__dirname, "sprites"),
                    cssClassPrefix: "client-",
                    dtsOptions: {
                        module: true,
                        enumName: "TestIcons",
                        classUnionName: "TestIconClasses",
                    },
                    cssOptions: [
                        {
                            scale: 1,
                            selector: ".icon",
                            unit: "px"
                        },
                        {
                            scale: 2,
                            selector: ".icon_x2",
                            unit: "px"
                        },
                        {
                            scale: 1,
                            selector: ".icon_em",
                            unit: "em"
                        }
                    ]
                }
            }
        }),
        new HtmlWebpackPlugin()
    ],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [
                    "ts-loader"
                ]
            }
        ]
    },
    mode: process.env.NODE_ENV === "development" ? "development" : "production",
    devServer: {
        contentBase: path.join(__dirname, 'dist'),
        compress: true,
        port: 9000,
    },
    resolve: {
        extensions: [".ts", ".tsx", ".css", ".js"]
    },
    output: {
        filename: "[name].[contenthash].js",
        path: path.resolve(__dirname, "dist")
    }
} as Configuration;