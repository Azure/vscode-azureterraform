/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

export function isTerminalSetToCloudShell(): boolean {
    return vscode.workspace.getConfiguration().get("azureTerraform.terminal") === "cloudshell";
}

export function getSyncFileBlobPattern(): vscode.GlobPattern {
    return vscode.workspace.getConfiguration().get("azureTerraform.files");
}

export function getResourceGroupForTest(): string {
    return vscode.workspace.getConfiguration().get("azureTerraform.test.aciResourceGroup");
}

export function getAciNameForTest(): string {
    return vscode.workspace.getConfiguration().get("azureTerraform.test.aciName");
}

export function getAciGroupForTest(): string {
    return vscode.workspace.getConfiguration().get("azureTerraform.aciContainerGroup");
}

export function getLocationForTest(): string {
    return vscode.workspace.getConfiguration().get("azureTerraform.test.location");
}

export function getImageNameForTest(): string {
    return vscode.workspace.getConfiguration().get("azureTerraform.test.imageName");
}

export function getCheckTerraformCmd(): boolean {
    return vscode.workspace.getConfiguration().get("azureTerraform.checkTerraformCmd");
}

export function setCheckTerraformCmd(checked: boolean): void {
    vscode.workspace.getConfiguration().update("azureTerraform.checkTerraformCmd", checked);
}
