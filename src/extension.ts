"use strict";

import * as _ from "lodash";
import * as vscode from "vscode";
import { TelemetryWrapper } from "vscode-extension-telemetry-wrapper";
import { BaseShell } from "./baseShell";
import { CloudShell } from "./cloudShell";
import { IntegratedShell } from "./integratedShell";
import { getSyncFileBlobPattern, isTerminalSetToCloudShell } from "./utils/settingUtils";
import { DialogOption } from "./utils/uiUtils";

let cloudShell: CloudShell;
let integratedShell: IntegratedShell;

function getShell(): BaseShell {
    const isCloudShell: boolean = isTerminalSetToCloudShell();
    const session = TelemetryWrapper.currentSession();
    if (session && session.extraProperties) {
        session.extraProperties.isCloudShell = isCloudShell;
    }

    if (isCloudShell) {
        return cloudShell;
    }
    return integratedShell;
}

export async function activate(ctx: vscode.ExtensionContext) {
    cloudShell = new CloudShell();
    integratedShell = new IntegratedShell();

    await TelemetryWrapper.initilizeFromJsonFile(ctx.asAbsolutePath("./package.json"));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.init", () => {
        getShell().runTerraformCmd("terraform init");
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.plan", () => {
        getShell().runTerraformCmd("terraform plan");
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.apply", () => {
        getShell().runTerraformCmd("terraform apply");
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.destroy", () => {
        getShell().runTerraformCmd("terraform destroy");
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.refresh", () => {
        getShell().runTerraformCmd("terraform refresh");
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.validate", () => {
        getShell().runTerraformCmd("terraform validate");
    }));

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.visualize", async () => {
        if (isTerminalSetToCloudShell()) {
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

    ctx.subscriptions.push(TelemetryWrapper.registerCommand("azureTerraform.push", async () => {
        if (isTerminalSetToCloudShell()) {
            if (_.isEmpty(vscode.workspace.workspaceFolders)) {
                vscode.window.showInformationMessage("Please open a workspace in VS Code first.");
                return;
            }
            const tfFiles: vscode.Uri[] = await vscode.workspace.findFiles(getSyncFileBlobPattern());
            await cloudShell.pushFiles(tfFiles);
        } else {
            vscode.window.showErrorMessage("Push function only available when using cloudshell.");
        }
    }));
}

// tslint:disable-next-line:no-empty
export function deactivate(): void { }
