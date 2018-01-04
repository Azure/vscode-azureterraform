"use strict";
import { AzureAccount } from "./azure-account.api";
import { BaseShell } from "./baseShell";
import { openCloudConsole } from "./cloudConsole";
import { delay } from "./cloudConsoleLauncher";
import { Constants } from "./Constants";
import { escapeFile, TerminalType, TFTerminal } from "./shared";
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

    protected runTerraformInternal(TFCommand: string) {

        // Workaround the TLS error
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = "0";

        // TODO: Check if logged with azure account
        if (this.csTerm.terminal == null) {
            this.startCloudShell().then((terminal) => {
                    this.csTerm.terminal = terminal[0];
                    this.csTerm.ws = terminal[1];
                    this.runTFCommand(TFCommand, this.csTerm.terminal);
            });
        } else {
            this.runTFCommand(TFCommand, this.csTerm.terminal);
        }

    }

    protected initShellInternal() {
        // Reacting to the deletion of the terminal window
        if ("onDidCloseTerminal" in <any>vscode.window) {
            (<any>vscode.window).onDidCloseTerminal((terminal) => {
                if (terminal == this.csTerm.terminal) {
                    this.outputLine("\nTerraform CloudShell Term closed", terminal.name);
                    console.log("CloudShell terminal was closed");
                    fsExtra.removeSync(tempFile);
                    this.csTerm.terminal = null;
                }
            });
        }

        // Reacting to the deletion of a file in the workspace
        if ("onDidCloseTextDocument" in <any>vscode.workspace) {
            (<any>vscode.workspace).onDidCloseTextDocument((textDocument) => {
                console.log(`Document closed ${textDocument.fileName}`);
                // File deleted let's sync the workspace
                this.syncWorkspaceInternal(textDocument.fileName);
            });
        }

    }

    protected async syncWorkspaceInternal(file) {
        console.log(`Deleting ${path.basename(file)} in CloudShell`);
        const retryInterval = 500;
        const retryTimes = 30;

        // Checking if the terminal has been created
        if ( this.csTerm.terminal != null) {
            for (let i = 0; i < retryTimes; i++ ) {
                if (this.csTerm.ws.readyState !== ws.OPEN ) {
                    await delay (retryInterval);
                } else {
                        try {
                            this.csTerm.ws.send('rm ' + path.relative(vscode.workspace.rootPath, file) + ' \n');
                            // TODO: Add directory management
                        }
                        catch (err) {
                            console.log(err)
                        }
                        break;
                }
            }
        }
        else {
            vscode.window.showErrorMessage ("Open a terminal first");
            console.log("Terminal not opened when trying to transfer files");
        }
        
    }

    protected runTerraformTestsInternal(){
        
    }

    protected runTerraformAsyncInternal(TFConfiguration: string, TFCommand: string) : Promise<any>{
        return null;
    }

    protected async startCloudShell(): Promise<Terminal> {
        const accountAPI: AzureAccount = vscode.extensions.getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;
        var iTerm;

        await openCloudConsole(accountAPI, this._outputChannel, tempFile).then((terminal) => {
            // This is where we send the text to the terminal 
            console.log('Terminal obtained - moving on to running a command');
            // Running 'terraform version' in the newly created terminal  
            //this.runTFCommand("terraform version", terminal);
            iTerm = terminal;
            });
        console.log("\nEnd of the startCloudShell() - iTerm returned");
        return iTerm;
    }

    protected runTFCommand(command: string, terminal: Terminal) {
        console.log('Runing a command in an existing terminal ');
        var count = 30;
        if (terminal) {
            var _localthis = this;
            var interval = setInterval(function () {
                count--;
                console.log(count);
                if (count > 0) {
                    if (fsExtra.existsSync(tempFile)) {
                        //fsExtra.removeSync(tempFile);
                        console.log(`\Sending command: ${command}`);
                        terminal.sendText(command);
                        terminal.show();

                        count = 0;
                    }
                } else {
                    _localthis.stop(interval);
                }
            }, 500);
        } else {
            this._outputChannel.appendLine('\nConnecting to terminal failed, please retry.');
        }

    }

    protected async uploadTFFiles(TFFiles){
        console.log('Uploading files to CloudShell');
        const retry_interval = 500;
        const retry_times = 30;

        // Checking if the terminal has been created
        if ( this.csTerm.terminal != null) {
            for (var i = 0; i < retry_times; i++ ){
                if (this.csTerm.ws.readyState != ws.OPEN ){
                    await delay (retry_interval);
                } else {
                    for (let file of TFFiles.map( (a) => a.fsPath)) {
                        try {
                            if (fsExtra.existsSync(file)) { 
                                console.log(`Uploading file ${file} to cloud shell as ${path.relative(vscode.workspace.rootPath, file)}`)
                                const data = fsExtra.readFileSync(file, { encoding: 'utf8' }).toString();
                               // this.csTerm.ws.send('mkdir -p ' + path.relative(vscode.workspace.rootPath, path.dirname(file)) + ' \n'); 
                                this.csTerm.ws.send('mkdir -p ' + path.relative(vscode.workspace.rootPath, path.dirname(file)) 
                                + ' ; ' + 
                                'echo -e "' + escapeFile(data) + '" > ./' + path.relative(vscode.workspace.rootPath, file) + ' \n', function() {
                                        console.log(`File ${path.relative(vscode.workspace.rootPath, file)} send to CloudShell`);
                                    });
                                };   
                            }
                        catch (err) {
                            console.log(err)
                        }
                    }
                    vscode.window.showInformationMessage(`Uploaded all the text files in the current workspace to CloudShell`);
                    break;
                }
            }
        }
        else {
            const message = "Do you want to open CloudShell?"
            const ok : MessageItem = { title : "Yes" }
            const cancel : MessageItem = { title : "No", isCloseAffordance: true }
            vscode.window.showWarningMessage(message, ok, cancel).then( (response) => {
                if ( response === ok ) {
                    this.startCloudShell().then((terminal) => {
                        this.csTerm.terminal = terminal[0];
                        this.csTerm.ws = terminal[1];
                        console.log(`Obtained terminal info and ws\n`);
                        this.uploadTFFiles(TFFiles);
                        return;
                    });
                }
            });
            console.log("Terminal not opened when trying to transfer files");
        }
    }

    protected stop(interval: NodeJS.Timer): void {
        clearInterval(interval);
    }

}
