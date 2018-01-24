"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import { commands, Disposable, extensions, GlobPattern, MessageItem, window } from "vscode";

import { AzureServiceClient, BaseResource } from "ms-rest-azure";
import { join } from "path";

import { AzureAccount, AzureSession, AzureSubscription } from "./azure-account.api";
import { BaseShell } from "./baseShell";
import { CloudShell } from "./cloudShell";
import { Constants } from "./constants";
import { IntegratedShell } from "./integratedShell";
import { azFilePush } from "./shared";
import { TestOption } from "./utilities";
import { isDotInstalled } from "./utils/dotUtils";

let cs: CloudShell;
let is: IntegratedShell;
let outputChannel: vscode.OutputChannel;
let fileWatcher: vscode.FileSystemWatcher;
let isFirstPush = true;
let _disposable: Disposable;

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
    initFileWatcher();
    outputChannel.show();
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(ctx: vscode.ExtensionContext) {

    outputChannel = vscode.window.createOutputChannel("VSCode extension for Azure Terraform");

    init();

    outputChannel.appendLine("Loading extension");

    ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("tf-azure.files")) {
            // dispose of current file watcher and re-init
            fileWatcher.dispose();
            initFileWatcher();
        }
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.init", () => {
        getShell().runTerraformCmd("terraform init", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.plan", () => {
        getShell().runTerraformCmd("terraform plan", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.apply", () => {
        getShell().runTerraformCmd("terraform apply", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.destroy", () => {
        getShell().runTerraformCmd("terraform destroy", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.refresh", () => {
        getShell().runTerraformCmd("terraform refresh", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.validate", () => {
        getShell().runTerraformCmd("terraform validate", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.visualize", async () => {
        if (await isDotInstalled()) {
            await is.visualize(outputChannel);
        }
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.exectest", async () => {
        console.log("Testing current module");
        const pick: string = await vscode.window.showQuickPick(
            [ TestOption.lint, TestOption.e2enossh, TestOption.e2ewithssh, TestOption.custom ],
            { placeHolder: "Select the type of test that you want to run" },
        );
        if (pick) {
            await getShell().runTerraformTests(pick);
        }
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.push", () => {
        // Create a function that will sync the files to Cloudshell
        if (terminalSetToCloudshell()) {
            vscode.workspace.findFiles(filesGlobSetting()).then((tfFiles) => {
                cs.pushFiles(tfFiles, true);
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

export function workspaceSyncEnabled(): boolean {
    return vscode.workspace.getConfiguration("tf-azure").get("syncEnabled") as boolean;
}

export async function TFLogin(api: AzureAccount) {
    outputChannel.appendLine("Attempting - TFLogin");
    if (!(await api.waitForLogin())) {
        return commands.executeCommand("azure-account.askForLogin");
    }
    outputChannel.appendLine("Succeeded - TFLogin");
}

function initFileWatcher(): void {
    // TODO: Implement filewatcher handlers and config to automatically sync changes in workspace to cloudshell.
        const subscriptions: Disposable[] = [];

        fileWatcher = vscode.workspace.createFileSystemWatcher(filesGlobSetting());

        // enable file watcher to detect file changes.
        fileWatcher.onDidDelete((deletedUri) => {
            if (terminalSetToCloudshell() && workspaceSyncEnabled()) {

                cs.deleteFiles([deletedUri]);
            }
        }, this, subscriptions);
        fileWatcher.onDidCreate((createdUri) => {
            pushHelper(createdUri);
        }, this, subscriptions);
        fileWatcher.onDidChange((changedUri) => {
            pushHelper(changedUri);
        }, this, subscriptions);

        this._disposable = Disposable.from(...subscriptions);
}

function pushHelper(uri: vscode.Uri) {
    if (terminalSetToCloudshell() && workspaceSyncEnabled()) {
        if (isFirstPush) {
            // do initial sync of workspace before enabling file watcher.
            vscode.workspace.findFiles(filesGlobSetting()).then((tfFiles) => {
                cs.pushFiles(tfFiles, false);
            });
            isFirstPush = false;
            return;
        }
        cs.pushFiles([uri], false);
    }
}

export function deactivate(): void {
    this._disposable.dispose();
    if (fileWatcher) {
		fileWatcher.dispose();
    }
}
