import * as path from "path";
import {Configuration} from "webpack";
import {CleanWebpackPlugin} from "clean-webpack-plugin";
import * as CopyWebpackPlugin from "copy-webpack-plugin";

export = {
    entry: "./plugin/index.ts",
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: "ts-loader"
            }
        ]
    },

    plugins: [
        new CleanWebpackPlugin(),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.join(__dirname, "package.json"),
                    to: path.join(__dirname, "dist")
                },
                {
                    from: path.join(__dirname, "package-lock.json"),
                    to: path.join(__dirname, "dist")
                }
            ]
        })
    ],

    mode: process.env.NODE_ENV === "development" ? "development" : "production",

    resolve: {
        extensions: [".ts", ".tsx", ".js"]
    },

    externals: [
        (_, request, callback) => {
            if(request.match(/^webpack(-sources)?(\/.*|$).*/))
                callback(null, "commonjs " + request);
            else
                callback();
        },
        {
            "fs-extra": "commonjs fs-extra",
            "path": "commonjs path"
        }
    ],

    target: "node",
    output: {
        path: process.env.OUTPUT_PATH || path.resolve(__dirname, "dist"),
        filename: "plugin.js",

        libraryTarget: "umd",
        library: "svg-sprite-plugin"
    }
} as Configuration;