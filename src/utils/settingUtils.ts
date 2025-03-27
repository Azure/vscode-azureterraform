/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

export function getImageNameForTest(): string {
    return vscode.workspace.getConfiguration().get("azureTerraform.test.imageName");
}

export function getCheckTerraformCmd(): boolean {
    return vscode.workspace.getConfiguration().get("azureTerraform.checkTerraformCmd");
}

export function setCheckTerraformCmd(checked: boolean): void {
    vscode.workspace.getConfiguration().update("azureTerraform.checkTerraformCmd", checked);
}
