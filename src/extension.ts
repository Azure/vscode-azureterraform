'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { extensions, commands, Disposable, window } from 'vscode';
import { AzureAccount, AzureSession, AzureSubscription } from './azure-account.api';
import { AzureServiceClient, BaseResource } from 'ms-rest-azure';
import { CloudShell } from './cloudShell';
import { IntegratedShell } from './integratedShell';
import { BaseShell } from './baseShell';
import { join } from 'path';
import { TestOption, isDotInstalled } from './utilities';
import { azFilePush } from './shared';
import { Constants } from './constants'; 

export var CSTerminal: boolean;

function getShell(outputChannel: vscode.OutputChannel): BaseShell {
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
    let activeShell = getShell(outputChannel);


    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.init', () => {
        activeShell.runTerraformCmd("terraform init", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.plan', () => {
        activeShell.runTerraformCmd("terraform plan", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.apply', () => {
        activeShell.runTerraformCmd("terraform apply", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.destroy', () => {
        activeShell.runTerraformCmd("terraform destroy", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.refresh', () => {
        activeShell.runTerraformCmd("terraform refresh", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.validate', () => {
        activeShell.runTerraformCmd("terraform validate", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.visualize', () => {
        isDotInstalled(outputChannel, function (err) {
            if (err) {
                console.log('GraphViz - Dot not installed');
            }
            else{
                var iShell = new IntegratedShell(outputChannel);
                iShell.visualize();
            }
        });

    }));

    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.exectest', () => {
        console.log('Testing current module'); 
        // var iShell = new IntegratedShell(outputChannel);
        // // TODO - asking the type of test to run e2e or lint
        vscode.window.showQuickPick([TestOption.lint, TestOption.e2enossh, TestOption.e2ewithssh, TestOption.custom], { placeHolder: "Select the type of test that you want to run" }).then((pick) => {
            //iShell.runTerraformTests(pick);
            activeShell.runTerraformTests(pick)
        })
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand('vscode-terraform-azure.push', () => {
        // Create a function that will sync the files to Cloudshell
        if(CSTerminal)
        {
        vscode.workspace.findFiles(vscode.workspace.getConfiguration('tf-azure').get('files')).then(TFfiles => {
            activeShell.copyTerraformFiles(TFfiles);
        });
        }
        else{
            vscode.window.showErrorMessage("Push function only available when using cloudshell.")
            .then(() => {return;})
        }
    }));
}

export async function TFLogin(api: AzureAccount) {
    console.log('entering TFLogin')
    if (!(await api.waitForLogin())) {
        return commands.executeCommand('azure-account.askForLogin');
    }
    console.log('done TFLogin')
}

// this method is called when your extension is deactivated
export function deactivate() {

}
