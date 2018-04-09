/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import * as _ from "lodash";
import * as vscode from "vscode";
import { TelemetryWrapper } from "vscode-extension-telemetry-wrapper";
import { terraformShellManager } from "./terraformShellManager";
import { getSyncFileBlobPattern, isTerminalSetToCloudShell } from "./utils/settingUtils";
import { checkTerraformInstalled } from "./utils/terraformUtils";
import { DialogOption } from "./utils/uiUtils";

export async function activate(ctx: vscode.ExtensionContext) {
    await checkTerraformInstalled();
    await TelemetryWrapper.initilizeFromJsonFile(ctx.asAbsolutePath("./package.json"));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.init", () => {
        terraformShellManager.getShell().runTerraformCmd("terraform init");
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.plan", () => {
        terraformShellManager.getShell().runTerraformCmd("terraform plan");
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.apply", () => {
        terraformShellManager.getShell().runTerraformCmd("terraform apply");
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.destroy", () => {
        terraformShellManager.getShell().runTerraformCmd("terraform destroy");
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.refresh", () => {
        terraformShellManager.getShell().runTerraformCmd("terraform refresh");
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.validate", () => {
        terraformShellManager.getShell().runTerraformCmd("terraform validate");
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

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.push", async () => {
        if (isTerminalSetToCloudShell()) {
            if (_.isEmpty(vscode.workspace.workspaceFolders)) {
                vscode.window.showInformationMessage("Please open a workspace in VS Code first.");
                return;
            }
            const tfFiles: vscode.Uri[] = await vscode.workspace.findFiles(getSyncFileBlobPattern());
            await terraformShellManager.getCloudShell().pushFiles(tfFiles);
        } else {
            vscode.window.showErrorMessage("Push function only available when using cloudshell.");
        }
    }));
}

export function deactivate(): void {
    terraformShellManager.dispose();
 }
