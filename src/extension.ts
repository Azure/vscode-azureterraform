'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { tfapply } from './commands/tf-apply'
import { tfdestroy } from './commands/tf-destroy'
import { tfinit } from './commands/tf-init'
import { tfplan } from './commands/tf-plan'
import { tfrefresh } from './commands/tf-refresh'
import { tfvalidate } from './commands/tf-validate'
import { extensions, commands } from 'vscode';
import { AzureAccount }from './azure-account.api';
import { AzureServiceClient } from 'ms-rest-azure';
import { openCloudConsole, OSes } from './cloudConsole';
import { CloudShellRunner } from './cloudShellRunner';

export var tfterminal;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(ctx: vscode.ExtensionContext) {

    console.log('Loading extension "vscode-terraform-azure"');

    var outputChannel = vscode.window.createOutputChannel("VSCode extension for Ansible");    
    var cloudShellRunner = new CloudShellRunner(outputChannel);
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is 
    const azureAccount: AzureAccount = vscode.extensions.getExtension<AzureAccount>('ms-vscode.azure-account')!.exports;

    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.cloudshell', () => {
        cloudShellRunner.runTerraform(); }
    ));
    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.init', tfinit));
    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.plan', tfplan));
    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.apply', tfapply));
    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.destroy', tfdestroy));
    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.refresh', tfrefresh));
    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.validate', tfvalidate));

    if ('onDidCloseTerminal' in <any>vscode.window) {
		(<any>vscode.window).onDidCloseTerminal((terminal) => {
            if (terminal == tfterminal ) {
                console.log('Terraform Terminal closed', terminal.name);
                tfterminal = null;
            }
		});
    }
}

export function getTerraformTerminal(): vscode.Terminal {
    
    if ( tfterminal == null ) {
        tfterminal = vscode.window.createTerminal("Terraform")
    }
    return tfterminal
}

export async function TFLogin(api: AzureAccount){
    console.log('entering TFLogin')
            if (!(await api.waitForLogin())){
                return commands.executeCommand('azure-account.askForLogin');
            }
    console.log('done TFLogin')
}

// this method is called when your extension is deactivated
export function deactivate() {
}
