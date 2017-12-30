"use strict";

import { BaseShell } from './baseShell';
import * as vscode from 'vscode';
import { AzureAccount } from './azure-account.api';
import { Constants } from './Constants';
import * as path from 'path';
//import * as opn from 'opn';
import * as fsExtra from 'fs-extra';
import * as ost from 'os';
import { setInterval, clearInterval } from 'timers';
import { Terminal, ThemeColor } from 'vscode';
import { openCloudConsole } from './cloudConsole';
import { TerminalType, TFTerminal, escapeFile} from './shared';
import { CSTerminal } from './utilities';
import { configure } from 'vscode/lib/testrunner';
import * as extension from './extension';
import { cursorTo } from 'readline';
import { delay } from './cloudConsoleLauncher';
import * as ws from 'ws';
import { escape } from 'querystring';


const tempFile = path.join(ost.tmpdir(), 'cloudshell' + vscode.env.sessionId + '.log');

export class CloudShell extends BaseShell {

    protected csTerm = new TFTerminal(
        TerminalType.CloudShell,
        Constants.TerraformTerminalName);

    protected runTerraformInternal(TFconfiguration: string, TFCommand: string) {
        
        // Workaround the TLS error
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = "0";

        // TODO: Check if logged with azure account 
        if (this.csTerm.terminal == null) {
            this.startCloudShell().then(terminal => {
                    this.csTerm.terminal = terminal[0];
                    this.csTerm.ws = terminal[1];
                    console.log('Terminal not existing already');
            });
        } 

        delay(500).then(() => {
            this.runTFCommand(TFCommand, this.csTerm.terminal);
        });
        //const installedExtension: any[] = vscode.extensions.all;
        //this.runTerraformCmd("terraform");
    }

    protected initShellInternal()
    {
        if ('onDidCloseTerminal' in <any>vscode.window) {
            (<any>vscode.window).onDidCloseTerminal((terminal) => {
                if (terminal == this.csTerm.terminal) {
                    this.outputLine('\nTerraform CloudShell Term closed', terminal.name);
                    console.log('CloudShell terminal was closed');
                    fsExtra.removeSync(tempFile);
                    this.csTerm.terminal = null;
                }
            });
        }


        
    }

    protected syncWorkspaceInternal()
    {
        
    }

    protected runTerraformTestsInternal(){
        
    }

    protected runTerraformAsyncInternal(TFConfiguration: string, TFCommand: string) : Promise<any>{
        return null;
    }

    protected async startCloudShell(): Promise<Terminal> {
        const accountAPI: AzureAccount = vscode.extensions.getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;
        var iTerm;

        await openCloudConsole(accountAPI, this._outputChannel, tempFile).then(terminal => {
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
                        console.log("\Sending the command");
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

        for (var i = 0; i < retry_times; i++ ){
            if (this.csTerm.ws.readyState != ws.OPEN ){
                await delay (retry_interval);
            } else {
                for (let file of TFFiles.map( a => a.fileName)) {
                    try {
                        if (fsExtra.existsSync(file)) { 
                        const data = fsExtra.readFileSync(file, { encoding: 'utf8' }).toString();
                        this.csTerm.ws.send('echo -e "' + escapeFile(data) + '" > ' + path.basename(file) + ' \n');
                        }
                    }
                    catch (err) {
                        console.log(err)
                    }
                }
                break;
            }

        }

    }

    protected stop(interval: NodeJS.Timer): void {
        clearInterval(interval);
    }

}