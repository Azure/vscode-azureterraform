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
import { Terminal } from 'vscode';
import { openCloudConsole } from './cloudConsole';
import { TerminalType } from './shared';
import { CSTerminal } from './utilities';
import { configure } from 'vscode/lib/testrunner';

const tempFile = path.join(ost.tmpdir(), 'cloudshell' + vscode.env.sessionId + '.log');

export class CloudShell extends BaseShell {

    protected runTerraformInternal(TFconfiguration: string, TFCommand: string): void {
        
        // TODO: Check if logged with azure account 

        this.startCloudShell()
        //const installedExtension: any[] = vscode.extensions.all;
    }

    protected initShellInternal()
    {
        
    }

    protected syncWorkspaceInternal()
    {
        
    }

    protected runTerraformTestsInternal(){
        
    }

    protected runTerraformAsyncInternal(TFConfiguration: string, TFCommand: string) : Promise<any>{
        return null;
    }

    protected startCloudShell(): void {
        const accountAPI: AzureAccount = vscode.extensions.getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;

        openCloudConsole(accountAPI, this._outputChannel, tempFile).then(terminal => {
            // This is where we send the text to the terminal 
            console.log('Terminal obtained - ready to proceed');
            this.runTFCommand(terminal);
        }
    )
        console.log('openCloudConsole returned to startCloudShell');

    }

    protected runTFCommand(csterminal : CSTerminal) {
        console.log('Console URI: {0}', csterminal.consoleURI );
        console.log('Tokens: {0}', csterminal.accessToken);
        // csterminal.terminal.show();

    }

    protected stop(interval: NodeJS.Timer): void {
        clearInterval(interval);
    }

}