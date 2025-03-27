/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import * as vscode from "vscode";
import * as TelemetryWrapper from "vscode-extension-telemetry-wrapper";
import { terraformShellManager } from "./terraformShellManager";
import { checkTerraformInstalled } from "./utils/terraformUtils";

export async function activate(ctx: vscode.ExtensionContext) {
    await checkTerraformInstalled();
    await TelemetryWrapper.initializeFromJsonFile(ctx.asAbsolutePath("./package.json"));

    ctx.subscriptions.push(TelemetryWrapper.instrumentOperationAsVsCodeCommand("azureTerraform.visualize", async () => {
        await terraformShellManager.getIntegratedShell().visualize();
    }));
}
