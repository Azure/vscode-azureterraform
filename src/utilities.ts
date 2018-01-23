"use strict";

import * as child_process from "child_process";
import * as vscode from "vscode";
import { Constants } from "./constants";

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
