"use strict";

import * as vscode from "vscode";

export function isServicePrincipalSetInEnv(): boolean {
    if (!(process.env.ARM_SUBSCRIPTION_ID && process.env.ARM_CLIENT_ID && process.env.ARM_CLIENT_SECRET &&
        process.env.ARM_TENANT_ID && process.env.ARM_TEST_LOCATION)) {
        vscode.window.showErrorMessage("Azure Service Principal is not set. (See documentation at: https://www.terraform.io/docs/providers/azurerm/authenticating_via_azure_cli.html)");
        return false;
    }
    return true;
}
