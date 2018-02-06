"use strict";

import { openUrlHint } from "./uiUtils";

export function isServicePrincipalSetInEnv(): boolean {
    if (!(process.env.ARM_SUBSCRIPTION_ID && process.env.ARM_CLIENT_ID && process.env.ARM_CLIENT_SECRET &&
        process.env.ARM_TENANT_ID && process.env.ARM_TEST_LOCATION)) {
        openUrlHint(
            "Azure Service Principal is not set.",
            "https://www.terraform.io/docs/providers/azurerm/authenticating_via_service_principal.html",
        );
        return false;
    }
    return true;
}
