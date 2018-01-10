"use strict";
import { AzureAccount, AzureSubscription } from "./azure-account.api";
import { BaseShell } from "./baseShell";
import { openCloudConsole, OSes } from "./cloudConsole";
import { delay } from "./cloudConsoleLauncher";
import { Constants } from "./Constants";
import { azFilePush, escapeFile, TerminalType, TFTerminal } from "./shared";
import { CSTerminal } from "./utilities";

import { Message } from "_debugger";
import { escape } from "querystring";
import { cursorTo } from "readline";
import { clearInterval, setInterval } from "timers";
import { MessageItem, Terminal, ThemeColor } from "vscode";
import { configure } from "vscode/lib/testrunner";

import * as fsExtra from "fs-extra";
import * as ost from "os";
import * as path from "path";
import * as vscode from "vscode";
import * as ws from "ws";

import * as extension from "./extension";

const tempFile = path.join(ost.tmpdir(), "cloudshell" + vscode.env.sessionId + ".log");

export class CloudShell extends BaseShell {

    protected csTerm = new TFTerminal(
        TerminalType.CloudShell,
        Constants.TerraformTerminalName);

    public async pushFiles(files: vscode.Uri[]) {
        this.outputChannel.appendLine("Uploading files to CloudShell");
        const RETRY_INTERVAL = 500;
        const RETRY_TIMES = 30;

        // Checking if the terminal has been created
        if ( this.csTerm.terminal != null) {
            for (let i = 0; i < RETRY_TIMES; i++ ) {
                if (this.csTerm.ws.readyState !== ws.OPEN ) {
                    await delay (RETRY_INTERVAL);
                } else {
                    for (const file of files.map( (a) => a.fsPath)) {
                        try {
                            if (fsExtra.existsSync(file)) {
                                this.outputChannel.appendLine(`Uploading file ${file} to cloud shell`);
                                azFilePush(this.csTerm.storageAccountName,
                                    this.csTerm.storageAccountKey,
                                    this.csTerm.fileShareName, file);
                            }
                        } catch (err) {
                            this.outputChannel.appendLine(err);
                        }
                    }
                    vscode.window.showInformationMessage(
                        `Uploaded all the text files in the current workspace to CloudShell`);
                    break;
                }
            }
        } else {
            const message = "Do you want to open CloudShell?";
            const ok: MessageItem = { title : "Yes" };
            const cancel: MessageItem = { title : "No", isCloseAffordance: true };
            vscode.window.showWarningMessage(message, ok, cancel).then( (response) => {
                if ( response === ok ) {
                    this.startCloudShell().then((terminal) => {
                        this.csTerm.terminal = terminal[0];
                        this.csTerm.ws = terminal[1];
                        this.outputChannel.appendLine(`Obtained terminal info and ws\n`);
                        this.pushFiles(files);
                        return;
                    });
                }
            });
            this.outputChannel.appendLine("Terminal not opened when trying to transfer files");
        }
    }

    public async pullFiles(files: vscode.Uri[]) {
        return;
    }

    public async deleteFiles(files: vscode.Uri[]) {
        return;
    }

    protected runTerraformInternal(TFCommand: string) {

        // Workaround the TLS error
        /* tslint:disable:no-string-literal */
        process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
        /* tslint:enable:no-string-literal */

        // TODO: Check if logged with azure account
        if (this.csTerm.terminal == null) {
            this.startCloudShell().then((terminal) => {
                    this.csTerm.terminal = terminal[0];
                    this.csTerm.ws = terminal[1];
                    this.csTerm.storageAccountName = terminal[2];
                    this.csTerm.storageAccountKey = terminal[3];
                    this.csTerm.fileShareName = terminal[4];
                    this.runTFCommand(TFCommand, this.csTerm.terminal);
            });
        } else {
            this.runTFCommand(TFCommand, this.csTerm.terminal);
        }

    }

    protected initShellInternal() {
        // Reacting to the deletion of the terminal window
        if ("onDidCloseTerminal" in vscode.window as any) {
            (vscode.window as any).onDidCloseTerminal((terminal) => {
                if (terminal === this.csTerm.terminal) {
                    this.outputLine("\nTerraform CloudShell Term closed", terminal.name);
                    this.outputChannel.appendLine("CloudShell terminal was closed");
                    fsExtra.removeSync(tempFile);
                    this.csTerm.terminal = null;
                }
            });
        }

        // Reacting to the deletion of a file in the workspace
        if ("onDidCloseTextDocument" in vscode.workspace as any) {
            (vscode.workspace as any).onDidCloseTextDocument((textDocument) => {
                this.outputChannel.appendLine(`Document closed ${textDocument.fileName}`);
                // File deleted let"s sync the workspace
                // TODO: Implement logic to handle deleted files
            });
        }

    }

    protected async syncWorkspaceInternal(file) {
        this.outputChannel.appendLine(`Deleting ${path.basename(file)} in CloudShell`);
        const retryInterval = 500;
        const retryTimes = 30;

        // Checking if the terminal has been created
        if ( this.csTerm.terminal != null) {
            for (let i = 0; i < retryTimes; i++ ) {
                if (this.csTerm.ws.readyState !== ws.OPEN ) {
                    await delay (retryInterval);
                } else {
                        try {
                            this.csTerm.ws.send("rm " + path.relative(vscode.workspace.rootPath, file) + " \n");
                            // TODO: Add directory management
                        } catch (err) {
                            this.outputChannel.appendLine(err);
                        }
                        break;
                }
            }
        } else {
            vscode.window.showErrorMessage ("Open a terminal first");
            this.outputChannel.appendLine("Terminal not opened when trying to transfer files");
        }
    }

    protected runTerraformTestsInternal() {
        return;
    }

    protected runTerraformAsyncInternal(TFConfiguration: string, TFCommand: string): Promise<any> {
        return null;
    }

    protected async startCloudShell(): Promise<Terminal> {
        const accountAPI: AzureAccount = vscode.extensions
            .getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;

        const azureSubscription: AzureSubscription = vscode.extensions
            .getExtension<AzureSubscription>("ms-vscode.azure-account")!.exports;

        let iTerm;

        const os = process.platform === "win32" ? OSes.WIndows : OSes.Linux;
        await openCloudConsole(accountAPI, azureSubscription, os, this.outputChannel, tempFile).then((terminal) => {

            // This is where we send the text to the terminal
            this.outputChannel.appendLine("Terminal obtained - moving on to running a command");
            iTerm = terminal;
            });
        this.outputChannel.appendLine("\nEnd of the startCloudShell() - iTerm returned");
        return iTerm;
    }

    protected runTFCommand(command: string, terminal: Terminal) {
        this.outputChannel.appendLine("Runing a command in an existing terminal ");
        let count = 30;
        if (terminal) {
            const localThis = this;
            const interval = setInterval (() => {
                count--;
                this.outputChannel.appendLine(count.toString());
                if (count > 0) {
                    if (fsExtra.existsSync(tempFile)) {
                        this.outputChannel.appendLine(`\Sending command: ${command}`);
                        terminal.sendText(command);
                        terminal.show();

                        count = 0;
                    }
                } else {
                    localThis.stop(interval);
                }
            }, 500);
        } else {
            this.outputChannel.appendLine("\nConnecting to terminal failed, please retry.");
        }

    }

    protected stop(interval: NodeJS.Timer): void {
        clearInterval(interval);
    }

}
