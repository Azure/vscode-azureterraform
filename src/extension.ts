"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import { commands, Disposable, extensions, GlobPattern, window } from "vscode";

import { AzureServiceClient, BaseResource } from "ms-rest-azure";
import { join } from "path";

import { AzureAccount, AzureSession, AzureSubscription } from "./azure-account.api";
import { BaseShell } from "./baseShell";
import { CloudShell } from "./cloudShell";
import { IntegratedShell } from "./integratedShell";
import { azFilePush } from "./shared";
import { isDotInstalled, TestOption } from "./utilities";

let cs: CloudShell;
let is: IntegratedShell;
let outputChannel: vscode.OutputChannel;

function getShell(): BaseShell {
    let activeShell = null;
    if (terminalSetToCloudshell()) {
        activeShell = cs;
    } else {
        activeShell = is;
    }

    return activeShell;
}

function init(): void {
    cs = new CloudShell(outputChannel);
    is = new IntegratedShell(outputChannel);
    outputChannel.show();
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(ctx: vscode.ExtensionContext) {

    outputChannel = vscode.window.createOutputChannel("VSCode extension for Azure Terraform");

    init();

    outputChannel.appendLine("Loading extension");

    const fileWatcher = vscode.workspace.createFileSystemWatcher(filesGlobSetting());

    // TODO: Implement filewatcher handlers
    fileWatcher.onDidDelete((deletedUri) => {
        outputChannel.appendLine("Deleted: " + deletedUri.path);
    });
    fileWatcher.onDidCreate((createdUri) => {
        outputChannel.appendLine("Created: " + createdUri.path);
    });
    fileWatcher.onDidChange((changedUri) => {
        outputChannel.appendLine("Changed: " + changedUri.path);
    });

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.init", () => {
        getShell().runTerraformCmd("terraform init");
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.plan", () => {
        getShell().runTerraformCmd("terraform plan");
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.apply", () => {
        getShell().runTerraformCmd("terraform apply");
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.destroy", () => {
        getShell().runTerraformCmd("terraform destroy");
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.refresh", () => {
        getShell().runTerraformCmd("terraform refresh");
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.validate", () => {
        getShell().runTerraformCmd("terraform validate");
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.visualize", () => {
        isDotInstalled(outputChannel, (err) => {
            if (err) {
                outputChannel.appendLine(err);
            } else {
                is.visualize();
            }
        });

    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.exectest", () => {
        outputChannel.appendLine("Testing current module");

        // TODO - asking the type of test to run e2e or lint
        vscode.window.showQuickPick([TestOption.lint, TestOption.e2enossh, TestOption.e2ewithssh, TestOption.custom],
            { placeHolder: "Select the type of test that you want to run" }).then((pick) => {
            is.runTerraformTests(pick);
        });
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.push", () => {
        // Create a function that will sync the files to Cloudshell
        if (terminalSetToCloudshell()) {
            vscode.workspace.findFiles(filesGlobSetting()).then((tfFiles) => {
                cs.pushFiles(tfFiles);
            });
        } else {
            vscode.window.showErrorMessage("Push function only available when using cloudshell.")
                .then(() => { return; });
        }
    }));
}
export function terminalSetToCloudshell(): boolean {
    return (vscode.workspace.getConfiguration("tf-azure").get("terminal") === "cloudshell") as boolean;
}

export function filesGlobSetting(): GlobPattern {
    return vscode.workspace.getConfiguration("tf-azure").get("files") as GlobPattern;
}

export async function TFLogin(api: AzureAccount) {
    outputChannel.appendLine("Attempting - TFLogin");
    if (!(await api.waitForLogin())) {
        return commands.executeCommand("azure-account.askForLogin");
    }
    outputChannel.appendLine("Succeeded - TFLogin");
}
