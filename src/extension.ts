"use strict";

import * as vscode from "vscode";
import { BaseShell } from "./baseShell";
import { CloudShell } from "./cloudShell";
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

    ctx.subscriptions.push(vscode.commands.registerCommand("azureTerraform.init", () => {
        getShell().runTerraformCmd("terraform init");
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("azureTerraform.plan", () => {
        getShell().runTerraformCmd("terraform plan");
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("azureTerraform.apply", () => {
        getShell().runTerraformCmd("terraform apply");
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("azureTerraform.destroy", () => {
        getShell().runTerraformCmd("terraform destroy");
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("azureTerraform.refresh", () => {
        getShell().runTerraformCmd("terraform refresh");
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("azureTerraform.validate", () => {
        getShell().runTerraformCmd("terraform validate");
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("azureTerraform.visualize", async () => {
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

    ctx.subscriptions.push(vscode.commands.registerCommand("azureTerraform.exectest", async () => {
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

    ctx.subscriptions.push(vscode.commands.registerCommand("azureTerraform.push", async () => {
        if (terminalSetToCloudshell()) {
            const tfFiles: vscode.Uri[] = await vscode.workspace.findFiles(filesGlobSetting());
            await cloudShell.pushFiles(tfFiles);
        } else {
            vscode.window.showErrorMessage("Push function only available when using cloudshell.");
        }
    }));
}
export function terminalSetToCloudshell(): boolean {
    return (vscode.workspace.getConfiguration("azureTerraform").get("terminal") === "cloudshell") as boolean;
}

export function filesGlobSetting(): vscode.GlobPattern {
    return vscode.workspace.getConfiguration("azureTerraform").get("files") as vscode.GlobPattern;
}

// tslint:disable-next-line:no-empty
export function deactivate(): void { }
