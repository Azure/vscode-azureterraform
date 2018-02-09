"use strict";

import * as vscode from "vscode";
import { BaseShell } from "./baseShell";
import { CloudShell } from "./cloudShell";
import { Constants } from "./constants";
import { IntegratedShell } from "./integratedShell";
import { TestOption } from "./shared";
import { DialogOption } from "./utils/uiUtils";
import { selectWorkspaceFolder } from "./utils/workspaceUtils";

let cloudShell: CloudShell;
let integratedShell: IntegratedShell;

function getShell(): BaseShell {
    if (terminalSetToCloudshell()) {
        return cloudShell;
    }
    return integratedShell;
}

export function activate(ctx: vscode.ExtensionContext) {
    cloudShell = new CloudShell();
    integratedShell = new IntegratedShell();

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
                "Visualization only works locally. Would you like to run it in the integrated terminal?",
                DialogOption.OK,
                DialogOption.CANCEL,
            );
            if (choice === DialogOption.CANCEL) {
                return;
            }
        }
        await integratedShell.visualize();
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.exectest", async () => {
        console.log("Testing current module");
        const pick: string = await vscode.window.showQuickPick(
            [TestOption.lint, TestOption.e2e, TestOption.custom],
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

    ctx.subscriptions.push(vscode.commands.registerCommand("vscode-terraform-azure.push", async () => {
        // Create a function that will sync the files to Cloudshell
        if (terminalSetToCloudshell()) {
            const tfFiles: vscode.Uri[] = await vscode.workspace.findFiles(filesGlobSetting());
            await cloudShell.pushFiles(tfFiles);
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
