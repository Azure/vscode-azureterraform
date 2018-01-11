"use strict";

import * as child_process from "child_process";
import * as fsExtra from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

import { Constants } from "./constants";

import { execSync } from "child_process";

export enum TestOption {
    lint = "lint",
    e2enossh = "e2e - no ssh",
    e2ewithssh = "e2e - with ssh",
    custom = "custom",
}

export class CSTerminal {
    public accessToken: string;
    public consoleURI: string;
    public terminal: vscode.Terminal;
}

export function localExecCmd(cmd: string, args: string[], outputChannel: vscode.OutputChannel, cb: (err?) => void): void {
    try {
        const cp = require("child_process").spawn(cmd, args);

        cp.stdout.on("data", (data) => {
            if (outputChannel) {
                outputChannel.append("\n" + String(data));
                outputChannel.show();
            }
        });

        cp.stderr.on("data", (data) => {
            if (outputChannel) {
                outputChannel.append(String(data));
            }
        });

        cp.on("close", (code) => {
            if (cb) {
                if (0 === code) {
                    cb();
                } else {
                    const e = new Error("External command failed");
                    e.stack = "exit code: " + code;
                    cb(e);
                }
            }
        });
    } catch (e) {
        e.stack = "ERROR: " + e;
        if (cb) {
            cb(e);
        }
    }
}

export function isDockerInstalled(outputChannel: vscode.OutputChannel, cb: (err?) => void): void {

    if (process.platform === "win32") {
        localExecCmd("cmd.exe", ["/c", "docker", "-v"], outputChannel, (err) => {
            if (err) {
                vscode.window.showErrorMessage("Docker isn\'t installed, please install Docker to continue (https://www.docker.com/).");
                cb(err);
            } else {
                cb();
            }
        });
    } else {

    localExecCmd("docker", ["version"], outputChannel, (err) => {
            if (err) {
                vscode.window.showErrorMessage("Docker isn\'t installed, please install Docker to continue (https://www.docker.com)");
                cb(err);
            } else {
                cb();
            }
        });
    }

}

export function isDotInstalled(outputChannel: vscode.OutputChannel, cb: (err?) => void): void {

    if (process.platform === "win32") {
        localExecCmd("cmd.exe", ["/c", "dot", "-V"], outputChannel, (err) => {
            if (err) {
                vscode.window.showErrorMessage("GraphViz - Dot is not installed, please install GraphViz to continue (https://www.graphviz.org).");
                cb(err);
            } else {
                cb();
            }
        });
    } else {

    localExecCmd("dot", ["-V"], outputChannel, (err) => {
            if (err) {
                vscode.window.showErrorMessage("GraphViz - Dot is not installed, please install GraphViz to continue (https://www.graphviz.org).");
                cb(err);
            } else {
                cb();
            }
        });
    }

}

export function getUserAgent(): string {
    return Constants.ExtensionId + "-" + vscode.extensions.getExtension(Constants.ExtensionId).packageJSON.version;
}

export function isEmpty(param) {
    if ( param === null || param.lenght === 0 || param === undefined) {
        return true;
    } else {
        return false;
    }
}

export interface IExecResult {
    error: Error | null;
    stdout: string;
    stderr: string;
}

export async function exec(command: string) {
    return new Promise<IExecResult>((resolve, reject) => {
        child_process.exec(command, (error, stdout, stderr) => {
            (error || stderr ? reject : resolve)({ error, stdout, stderr });
        });
    });
}
