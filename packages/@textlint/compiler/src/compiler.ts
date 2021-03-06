import webpack from "webpack";
import { generateCode } from "./CodeGenerator/worker-codegen";
import { CodeGeneraterOptions } from "./CodeGenerator/CodeGeneraterOptions";
import * as fs from "fs";
import path from "path";
// @ts-ignore
import rimraf from "rimraf"

export const createWebpackConfig = (inputFilePath: string, outputDir: string): webpack.Configuration => {
    return {
        mode: 'production',
        devtool: false,
        entry: {
            "textlint": inputFilePath
        },
        output: {
            library: 'textlint',
            libraryTarget: 'self' as any, // umd
            path: outputDir
        },
        plugins: [
            // https://github.com/azu/kuromojin injection
            // 1.x 2.x supports
            new webpack.DefinePlugin({
                'process.env.KUROMOJIN_DIC_PATH': JSON.stringify("https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict")
            })
        ],
        node: {
            fs: "empty"
        }
    };
};
export type compileOptions = {
    // compiler
    compileTarget: "webworker";
    outputDir: string;
    mode: "production" | "development";
} & CodeGeneraterOptions;
export const compile = async (options: compileOptions) => {
    const cwd = options.cwd || process.cwd();
    const code = await (() => {
        if (options.compileTarget === "webworker") {
            return generateCode({
                cwd,
                configFilePath: options.configFilePath
            });
        }
        throw new Error(`Unknown compileTarget: ${options.compileTarget}`);
    })();
    const tempDir = path.join(cwd, "__textlint_compier_temp");
    await fs.promises.mkdir(tempDir, {
        recursive: true,
    });
    const inputFilePath = path.join(tempDir, "input.js");
    await fs.promises.writeFile(inputFilePath, code, "utf-8")
    const outputFilePath = options.outputDir;
    return new Promise((resolve, reject) => {
        const config = createWebpackConfig(inputFilePath, outputFilePath);
        webpack([config], (error: Error & { details?: string; }, stats) => {
            if (error) {
                console.error(error.stack || error);
                if (error.details) {
                    console.error(error.details);
                }
                return reject(error);
            }

            const info = stats.toJson();
            if (stats.hasErrors()) {
                console.error(info.errors.join("\n"));
                return reject(new Error(info.errors.join("\n")));
            }
            if (stats.hasWarnings()) {
                console.warn(info.warnings);
            }
            resolve();
        })
    }).finally(() => {
        return rimraf.sync(tempDir);
    });
};
