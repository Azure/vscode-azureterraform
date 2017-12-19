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

const tempFile = path.join(ost.tmpdir(), 'cloudshell' + vscode.env.sessionId + '.log');

export class CloudShell extends BaseShell {

    protected runTerraformInternal(TFconfiguration: string, TFCommand: string): void {
        //const installedExtension: any[] = vscode.extensions.all;

        let azureAccount: AzureAccount;
        this.startCloudShell(TFconfiguration, TFCommand);
        return;
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

    protected startCloudShell(TFconfiguration: string, TFCommand: string): void {
        const msgOption: vscode.MessageOptions = { modal: false };
        const msgItem: vscode.MessageItem = { title: 'Confirm' };

        const cancelItem: vscode.MessageItem = { title: "View detail" };
        //const promptMsg = 'Run ansible playbook in Cloudshell will generate Azure usage fee since need uploading playbook to CloudShell !';
        //vscode.window.showWarningMessage(promptMsg, msgOption, msgItem, cancelItem).then(
        //    response => {
        //        if (response === msgItem) {
                    const accountApi: AzureAccount = vscode.extensions.getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;

                    // openCloudConsole(accountApi, OSes.Linux, [TFconfiguration], this._outputChannel, tempFile).then(terminal => {
                    //     var count = 30;
                    //     const interval = setInterval(function () {
                    //         count--;
                    //         if (count > 0) {
                    //             if (fsExtra.existsSync(tempFile)) {
                    //                 fsExtra.removeSync(tempFile);

                    //                 // terminal.sendText('export ' + Constants.UserAgentName + '=' + utilities.getUserAgent());
                    //                 terminal.sendText('terraform ' + TFCommand ); // + path.basename(TFconfiguration));
                    //                 terminal.show();

                    //                 count = 0;
                    //             }
                    //         } else {
                    //            // this.stop(interval);
                    //         }
                    //     }, 500);
                    // });


                // } else if (response === cancelItem) {
                //     //opn('https://docs.microsoft.com/en-us/azure/cloud-shell/pricing');
                // }
            //}
        //)

    }

    protected stop(interval: NodeJS.Timer): void {
        clearInterval(interval);
    }
}