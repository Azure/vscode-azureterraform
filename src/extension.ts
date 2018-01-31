"use strict";

import * as vscode from "vscode";
import { BaseShell } from "./baseShell";
import { CloudShell } from "./cloudShell";
import { Constants } from "./constants";
import { IntegratedShell } from "./integratedShell";
import { TestOption } from "./shared";
import { isDotInstalled } from "./utils/dotUtils";
import { selectWorkspaceFolder } from "./utils/workspaceUtils";

let cs: CloudShell;
let is: IntegratedShell;
let fileWatcher: vscode.FileSystemWatcher;
let isFirstPush = true;
let folder: vscode.WorkspaceFolder;

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
    cs = new CloudShell();
    is = new IntegratedShell();
    initFileWatcher(ctx);

    ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("tf-azure.files")) {
            // dispose of current file watcher and re-init
            fileWatcher.dispose();
            initFileWatcher(ctx);
        }
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.init", async () => {
        getShell().runTerraformCmd((await getChDirCmd()) + "terraform init", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.plan", async () => {
        getShell().runTerraformCmd((await getChDirCmd()) + "terraform plan", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.apply", async () => {
        getShell().runTerraformCmd((await getChDirCmd()) + "terraform apply", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.destroy", async () => {
        getShell().runTerraformCmd((await getChDirCmd()) + "terraform destroy", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.refresh", async () => {
        getShell().runTerraformCmd((await getChDirCmd()) + "terraform refresh", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.validate", async () => {
        getShell().runTerraformCmd((await getChDirCmd()) + "terraform validate", Constants.clouddrive);
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.visualize", async () => {
        if (await isDotInstalled()) {
            await is.visualize();
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
            vscode.window.showErrorMessage("Push function only available when using cloudshell.");
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

async function getChDirCmd(): Promise<string> {
    folder = await selectWorkspaceFolder();
    return folder ? "cd ~/clouddrive/" + folder.name + " && " : "";
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
