"use strict";
import { AzureAccount, AzureSubscription } from "./azure-account.api";
import { BaseShell } from "./baseShell";
import { openCloudConsole, OSes } from "./cloudConsole";
import { delay } from "./cloudConsoleLauncher";
import { Constants, aciConfig, exportTestScript } from "./Constants";
import { escapeFile, TerminalType, TFTerminal, azFilePush } from "./shared";
import { CSTerminal } from "./utilities";

import { Message } from "_debugger";
import { escape } from "querystring";
import { cursorTo } from "readline";
import { clearInterval, setInterval } from "timers";
import { MessageItem, Terminal, ThemeColor, ConfigurationTarget } from "vscode";
import { configure } from "vscode/lib/testrunner";

import * as fsExtra from "fs-extra";
import * as ost from "os";
import * as path from "path";
import * as vscode from "vscode";
import * as ws from "ws";

import * as extension from "./extension";
import { PassThrough } from "stream";

const tempFile = path.join(ost.tmpdir(), "cloudshell" + vscode.env.sessionId + ".log");

export class CloudShell extends BaseShell {

    protected csTerm = new TFTerminal(
        TerminalType.CloudShell,
        Constants.TerraformTerminalName);

    protected runTerraformInternal(TFCommand: string, WorkDir: string) {

        // Workaround the TLS error
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = "0";

        // TODO: Check if logged with azure account
        if (this.csTerm.terminal == null) {
            this.startCloudShell().then((terminal) => {
                    this.csTerm.terminal = terminal[0];
                    this.csTerm.ws = terminal[1];
                    this.csTerm.storageAccountName = terminal[2]
                    this.csTerm.storageAccountKey = terminal[3];
                    this.csTerm.fileShareName = terminal[4];
                    this.csTerm.ResourceGroup = terminal[5];
                    this.runTFCommand(TFCommand, WorkDir, this.csTerm.terminal);
            });
        } else {
            this.runTFCommand(TFCommand, WorkDir, this.csTerm.terminal);
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
                // TODO: Implement logic to handle deleted files
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

    protected async runTerraformTestsInternal(TestType: string){
        if ( (this.csTerm.terminal != null) && (this.csTerm.storageAccountKey != null) ) {
            let cloudDrivePath = `${vscode.workspace.name}${path.sep}.TFTesting`;
            let localPath = vscode.workspace.workspaceFolders[0].uri.fsPath+path.sep+".TFTesting";
            
            let TFConfiguration = escapeFile(aciConfig('TerraformTestRG', this.csTerm.storageAccountName, this.csTerm.fileShareName, 'westus', 'microsoft/terraform-test', '/bin/bash'));
            var testScript = cloudDrivePath + "/test.sh"

            // Writing the TF Configuration file on local drive 
            console.log('Writing TF Configuration for ACI');
            let shellscript = exportTestScript("lint", TFConfiguration, this.csTerm.ResourceGroup, this.csTerm.storageAccountName, this.csTerm.fileShareName, cloudDrivePath);
            await fsExtra.outputFile(localPath+path.sep+"test.sh", shellscript, function(err){
                console.log('Write file done');
            });

            // copy the file to CloudDrive 
            azFilePush(this.csTerm.storageAccountName, this.csTerm.storageAccountKey, this.csTerm.fileShareName, localPath+path.sep+"test.sh");
            
            // Run the shell script
            this.runTFCommand(`cd ~/clouddrive/${cloudDrivePath} && terraform init && terraform apply -auto-approve`, cloudDrivePath, this.csTerm.terminal);

            // run the command from CloudShell 
            // use source myscript.sh 

            
            // this.runTFCommand(`mkdir ${testDirectory}`, testDirectory, this.csTerm.terminal);
            
            
            
            // //let test = aciConfig('TerraformTestRG', 'MyStorage', 'MyShare', 'MyLocation', 'microsoft/test', '/bin/bash');
            
            // await this.runTFCommand(`mkdir ${testDirectory}
            // &&
            // echo -e "${TFConfiguration}" > ${testDirectory}/testfile.tf 
            // &&
            // read -s KEY && export TF_VAR_storage_account_key=$KEY
            // && 
            // ${this.csTerm.storageAccountKey}\n
            // &&
            // cd ${testDirectory} && terraform init && terraform apply -auto-approve\n
            // `, testDirectory ,this.csTerm.terminal);

            // await this.runTFCommand(`read -s KEY && export TF_VAR_storage_account_key=$KEY`, testDirectory , this.csTerm.terminal);
            // await this.runTFCommand(`${this.csTerm.storageAccountKey}\n`, testDirectory , this.csTerm.terminal);
            // await this.runTFCommand(`cd ${testDirectory} && terraform init && terraform apply -auto-approve`, Constants.clouddrive, this.csTerm.terminal);
        }
        else {
            const message = "A CloudShell session is needed, do you want to open CloudShell?"
            const ok : MessageItem = { title : "Yes" }
            const cancel : MessageItem = { title : "No", isCloseAffordance: true }
            vscode.window.showWarningMessage(message, ok, cancel).then( (response) => {
                if ( response === ok ) {
                    this.startCloudShell().then((terminal) => {
                        this.csTerm.terminal = terminal[0];
                        this.csTerm.ws = terminal[1];
                        this.csTerm.storageAccountName = terminal[2]
                        this.csTerm.storageAccountKey = terminal[3];
                        this.csTerm.fileShareName = terminal[4];
                        this.csTerm.ResourceGroup = terminal[5];
                        console.log(`Obtained terminal and fileshare data\n`);
                        this.runTerraformTestsInternal(TestType);
                        return;
                    });
                }
            });
            console.log("Terminal not opened when trying to transfer files");
        }
            
    }

    protected runTerraformAsyncInternal(TFConfiguration: string, TFCommand: string) : Promise<any>{
        return null;
    }

    protected async startCloudShell(): Promise<Terminal> {
        const accountAPI: AzureAccount = vscode.extensions.getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;
        const azureSubscription: AzureSubscription = vscode.extensions.getExtension<AzureSubscription>("ms-vscode.azure-account")!.exports;

        var iTerm;

        var os = process.platform === 'win32' ? OSes.WIndows : OSes.Linux;
        await openCloudConsole(accountAPI, azureSubscription, os, this._outputChannel, tempFile).then((terminal) => {

            // This is where we send the text to the terminal 
            console.log('Terminal obtained - moving on to running a command');
            // Running 'terraform version' in the newly created terminal  
            //this.runTFCommand("terraform version", terminal);
            iTerm = terminal;
            });
        console.log("\nEnd of the startCloudShell() - iTerm returned");
        return iTerm;
    }

    protected runTFCommand(command: string, workdir: string, terminal: Terminal) {
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
                        // terminal.sendText(`cd ${workdir} && ${command}`);
                        terminal.sendText(`${command}`);
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
        if ( (this.csTerm.terminal != null) && (this.csTerm.storageAccountKey != null) ) {
            for (var i = 0; i < retry_times; i++ ){
                if (this.csTerm.ws.readyState != ws.OPEN ){
                    await delay (retry_interval);
                } else {
                    for (let file of TFFiles.map( (a) => a.fsPath)) {
                        try {
                            if (fsExtra.existsSync(file)) { 
                                console.log(`Uploading file ${file} to cloud shell`);
                                azFilePush(this.csTerm.storageAccountName, this.csTerm.storageAccountKey, this.csTerm.fileShareName, file);
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
                        this.csTerm.storageAccountName = terminal[2]
                        this.csTerm.storageAccountKey = terminal[3];
                        this.csTerm.fileShareName = terminal[4];
                        this.csTerm.ResourceGroup = terminal[5];
                        console.log(`Obtained terminal and fileshare data\n`);
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
