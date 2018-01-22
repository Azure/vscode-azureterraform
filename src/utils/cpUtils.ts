"use strict";

import * as cp from "child_process";
import * as vscode from "vscode";

export async function executeCommand(outputChannel: vscode.OutputChannel | undefined, options: cp.SpawnOptions, command: string, ...args: string[]): Promise<string> {
    let result: string = "";
    await new Promise((resolve: () => void, reject: (e: Error) => void): void => {
        const childProc: cp.ChildProcess = cp.spawn(command, args, options);

        childProc.stdout.on("data", (data: string | Buffer) => {
            data = data.toString();
            result = result.concat(data);
            if (outputChannel) {
                outputChannel.append(data);
            }
        });

        childProc.stderr.on("data", (data: string | Buffer) => {
            if (outputChannel) {
                outputChannel.append(data.toString());
            }
        });

        childProc.on("error", reject);
        childProc.on("close", (code: number) => {
            if (code !== 0) {
                reject(new Error(`Command "${command} ${args.toString()}" failed with exit code "${code}".`));
            } else {
                resolve();
            }
        });
    });

    return result;
}
