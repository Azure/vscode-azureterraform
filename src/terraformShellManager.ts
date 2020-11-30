/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import * as TelemetryWrapper from "vscode-extension-telemetry-wrapper";
import { BaseShell } from "./baseShell";
import { AzureCloudShell } from "./cloudShell";
import { IntegratedShell } from "./integratedShell";
import { isTerminalSetToCloudShell } from "./utils/settingUtils";

export interface ITerraformShellManager {
    getShell(): BaseShell;
    getCloudShell(): AzureCloudShell;
    getIntegratedShell(): IntegratedShell;
    dispose(): void;
}

class TerraformShellManager implements ITerraformShellManager {
    private readonly cloudShell = new AzureCloudShell();
    private readonly integratedShell = new IntegratedShell();

    public getShell(): BaseShell {
        const isCloudShell: boolean = isTerminalSetToCloudShell();

        TelemetryWrapper.addContextProperty("isCloudShell", isCloudShell.toString())
        if (isCloudShell) {
            return this.cloudShell;
        }
        return this.integratedShell;
    }

    public getCloudShell(): AzureCloudShell {
        return this.cloudShell;
    }

    public getIntegratedShell(): IntegratedShell {
        return this.integratedShell;
    }

    public dispose(): void {
        this.cloudShell.dispose();
        this.integratedShell.dispose();
    }
}

export const terraformShellManager: ITerraformShellManager = new TerraformShellManager();
