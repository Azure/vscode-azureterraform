'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { extensions, commands, Disposable, window } from 'vscode';
import { AzureAccount }from './azure-account.api';
import { AzureServiceClient } from 'ms-rest-azure';
import { CloudShell } from './cloudShell';
import { IntegratedShell } from './integratedShell';
import { BaseShell } from './baseShell';
import { join } from 'path';
import { TestOption } from './utilities';


export var CSTerminal: boolean;


function getShell(outputChannel: vscode.OutputChannel) : BaseShell
{
    var activeShell = null;
    if (CSTerminal) {
        activeShell = new CloudShell(outputChannel);
    }
    else {
        activeShell = new IntegratedShell(outputChannel);
    }

    return activeShell;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(ctx: vscode.ExtensionContext) {

    console.log('Loading extension "vscode-terraform-azure"');
    CSTerminal = (vscode.workspace.getConfiguration('tf-azure').get('terminal') == "cloudshell");


    var outputChannel = vscode.window.createOutputChannel("VSCode extension for Azure Terraform");    
    // var cloudShellRunner = new CloudShellRunner(outputChannel);
    // var terminalRunner = new IntegratedTerminalRunner(outputChannel);
    let activeShell = getShell(outputChannel);



    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is 
    const azureAccount: AzureAccount = vscode.extensions.getExtension<AzureAccount>('ms-vscode.azure-account')!.exports;

    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.init', () => {
        activeShell.runTerraformCmd("terraform init");
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.plan', () =>{
        activeShell.runTerraformCmd("terraform plan");
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.apply', () => {
        activeShell.runTerraformCmd("terraform apply");
    }));
    
    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.destroy', () => {
        activeShell.runTerraformCmd("terraform destroy");
    }));
    
    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.refresh', () => {
        activeShell.runTerraformCmd("terraform refresh");
    }));
    
    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.validate', () => {
        activeShell.runTerraformCmd("terraform validate");
    }));

    if (!CSTerminal) {
        ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.visualize', () => {
            activeShell.runTerraformCmdAsync("terraform graph | dot -Tpng > graph.png").then(function(){;

            let uri = vscode.Uri.file(join(vscode.workspace.rootPath || '', './graph.png'));
            let b = commands.executeCommand('vscode.open', uri);
            return Promise.all([b]);});
        }));

        ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.exectest', () =>{
            console.log('Testing current module');


            // TODO - asking the type of test to run e2e or lint
            vscode.window.showQuickPick([TestOption.lint, TestOption.e2enossh, TestOption.e2ewithssh, TestOption.custom], {placeHolder: "Select the type of test that you want to run"}).then((pick) => {
                activeShell.runTerraformTests(pick);
            })



        }));
    }
    else {

    }
  
   // "tf-azure.terminal": "integrated"

    var dir = vscode.workspace.workspaceFolders[0].uri.fsPath;
//     = vscode.workspace.onDidChangeTextDocument
    // let subscriptions: Disposable[] = [];
    // vscode.window.

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
