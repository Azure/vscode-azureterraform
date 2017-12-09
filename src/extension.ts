'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "vscode-terraform-azure" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.plan',() => {
            vscode.window.showInformationMessage('Hello tf.plan');
        }),
        vscode.commands.registerCommand('extension.init',() => {
            vscode.window.showInformationMessage('Hello tf.init');
        }),
        vscode.commands.registerCommand('extension.visualize',() => {
            vscode.window.showInformationMessage('Hello tf.visualize');
        }),
        vscode.commands.registerCommand('extension.execTest',() => {
            vscode.window.showInformationMessage('Hello tf.execTest');
        }),
        vscode.commands.registerCommand('extension.apply',() => {
            vscode.window.showInformationMessage('Hello tf.apply');
        }),
        vscode.commands.registerCommand('extension.lint',() => {
            vscode.window.showInformationMessage('Hello tf.lint');
        })                                
    );
}

// this method is called when your extension is deactivated
export function deactivate() {
}