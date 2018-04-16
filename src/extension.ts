/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import * as _ from "lodash";
import * as vscode from "vscode";
import { TelemetryWrapper } from "vscode-extension-telemetry-wrapper";
import { TerraformCommand } from "./shared";
import { TestOption } from "./shared";
import { terraformShellManager } from "./terraformShellManager";
import { getSyncFileBlobPattern, isTerminalSetToCloudShell } from "./utils/settingUtils";
import { checkTerraformInstalled } from "./utils/terraformUtils";
import { DialogOption } from "./utils/uiUtils";
import { selectWorkspaceFolder } from "./utils/workspaceUtils";

export async function activate(ctx: vscode.ExtensionContext) {
    await checkTerraformInstalled();
    await TelemetryWrapper.initilizeFromJsonFile(ctx.asAbsolutePath("./package.json"));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.init", () => {
        terraformShellManager.getShell().runTerraformCmd(TerraformCommand.Init);
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.plan", () => {
        terraformShellManager.getShell().runTerraformCmd(TerraformCommand.Plan);
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.apply", () => {
        terraformShellManager.getShell().runTerraformCmd(TerraformCommand.Apply);
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.destroy", () => {
        terraformShellManager.getShell().runTerraformCmd(TerraformCommand.Destroy);
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.refresh", () => {
        terraformShellManager.getShell().runTerraformCmd(TerraformCommand.Refresh);
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.validate", () => {
        terraformShellManager.getShell().runTerraformCmd(TerraformCommand.Validate);
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.visualize", async () => {
        if (isTerminalSetToCloudShell()) {
            const choice: vscode.MessageItem = await vscode.window.showInformationMessage(
                "Visualization only works locally. Would you like to run it in the integrated terminal?",
                DialogOption.ok,
                DialogOption.cancel,
            );
            if (choice === DialogOption.cancel) {
                return;
            }
        }
        await terraformShellManager.getIntegratedShell().visualize();
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("azureTerraform.exectest", async () => {
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
        await terraformShellManager.getShell().runTerraformTests(pick, workingDirectory);
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.push", async () => {
        if (!isTerminalSetToCloudShell()) {
            vscode.window.showErrorMessage("Push function only available when using cloudshell.");
            return;
        }
        if (_.isEmpty(vscode.workspace.workspaceFolders)) {
            vscode.window.showInformationMessage("Please open a workspace in VS Code first.");
            return;
        }
        await terraformShellManager.getCloudShell().pushFiles(await vscode.workspace.findFiles(getSyncFileBlobPattern()));
    }));
}

export function deactivate(): void {
    terraformShellManager.dispose();
 }
