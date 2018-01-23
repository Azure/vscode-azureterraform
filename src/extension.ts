"use strict";

import * as vscode from "vscode";
import { BaseShell } from "./baseShell";
import { CloudShell } from "./cloudShell";
import { Constants } from "./constants";
import { IntegratedShell } from "./integratedShell";
import { TestOption } from "./shared";
import { isDotInstalled } from "./utils/dotUtils";

let cs: CloudShell;
let is: IntegratedShell;
let fileWatcher: vscode.FileSystemWatcher;
let isFirstPush = true;

function getShell(): BaseShell {
    let activeShell = null;
    if (terminalSetToCloudshell()) {
        activeShell = cs;
    } else {
        activeShell = is;
    }

    return activeShell;
}

export function activate(ctx: vscode.ExtensionContext) {

    const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel("VSCode extension for Azure Terraform");
    outputChannel.appendLine("Loading extension");

    cs = new CloudShell(outputChannel);
    is = new IntegratedShell(outputChannel);
    initFileWatcher(ctx);

    ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("tf-azure.files")) {
            // dispose of current file watcher and re-init
            fileWatcher.dispose();
            initFileWatcher(ctx);
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
            [TestOption.lint, TestOption.e2enossh, TestOption.e2ewithssh, TestOption.custom],
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

export function filesGlobSetting(): vscode.GlobPattern {
    return vscode.workspace.getConfiguration("tf-azure").get("files") as vscode.GlobPattern;
}

export function workspaceSyncEnabled(): boolean {
    return vscode.workspace.getConfiguration("tf-azure").get("syncEnabled") as boolean;
}

function initFileWatcher(ctx: vscode.ExtensionContext): void {
    fileWatcher = vscode.workspace.createFileSystemWatcher(filesGlobSetting());
    ctx.subscriptions.push(
        fileWatcher.onDidDelete((deletedUri) => {
            if (terminalSetToCloudshell() && workspaceSyncEnabled()) {
                cs.deleteFiles([deletedUri]);
            }
        }),
        fileWatcher.onDidCreate((createdUri) => pushHelper(createdUri)),
        fileWatcher.onDidChange((changedUri) => pushHelper(changedUri)),
    );
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
    if (fileWatcher) {
        fileWatcher.dispose();
    }
}
