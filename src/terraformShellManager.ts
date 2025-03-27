/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import { BaseShell } from "./baseShell";
import { IntegratedShell } from "./integratedShell";

export interface ITerraformShellManager {
    getShell(): BaseShell;
    getIntegratedShell(): IntegratedShell;
    dispose(): void;
}

class TerraformShellManager implements ITerraformShellManager {
    private readonly integratedShell = new IntegratedShell();

    public getShell(): BaseShell {
        return this.integratedShell;
    }

    public getIntegratedShell(): IntegratedShell {
        return this.integratedShell;
    }

    public dispose(): void {
        this.integratedShell.dispose();
    }
}

export const terraformShellManager: ITerraformShellManager = new TerraformShellManager();
