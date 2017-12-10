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
import { extensions } from 'vscode';

export var tfterminal;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(ctx: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Loading extension "vscode-terraform-azure"');
    
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

// this method is called when your extension is deactivated
export function deactivate() {
}
