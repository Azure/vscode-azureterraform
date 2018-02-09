"use strict";

import * as vscode from "vscode";
import { BaseShell } from "./baseShell";
import { CloudShell } from "./cloudShell";
import { Constants } from "./constants";
import { IntegratedShell } from "./integratedShell";
import { TestOption } from "./shared";
import { DialogOption } from "./utils/uiUtils";
import { selectWorkspaceFolder } from "./utils/workspaceUtils";

let cs: CloudShell;
let is: IntegratedShell;

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
        if (terminalSetToCloudshell()) {
            const choice: vscode.MessageItem = await vscode.window.showInformationMessage(
                "Visualize task is only available in integrated terminal. Would you like to continue?",
                DialogOption.OK,
                DialogOption.CANCEL,
            );
            if (choice === DialogOption.CANCEL) {
                return;
            }
        }
        await is.visualize();
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.exectest", async () => {
        console.log("Testing current module");
        const pick: string = await vscode.window.showQuickPick(
            [TestOption.lint, TestOption.e2enossh, TestOption.e2ewithssh, TestOption.custom],
            { placeHolder: "Select the type of test that you want to run" },
        );
        if (!pick) {
            return;
        }
        const workingDirectory: string = await selectWorkspaceFolder();
        if (!workingDirectory) {
            return;
        }
        await getShell().runTerraformTests(pick, workingDirectory);

    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.push", () => {
        // Create a function that will sync the files to Cloudshell
        if (terminalSetToCloudshell()) {
            vscode.workspace.findFiles(filesGlobSetting()).then((tfFiles) => {
                cs.pushFiles(tfFiles);
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

// tslint:disable-next-line:no-empty
export function deactivate(): void { }
