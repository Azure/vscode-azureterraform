/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import { executeCommand } from "./cpUtils";
import { openUrlHint } from "./uiUtils";

export async function checkTerraformInstalled(): Promise<void> {
    try {
        await executeCommand("terraform", ["-v"], { shell: true });
    } catch (error) {
        openUrlHint("Terraform is not installed, please make sure Terraform is in the PATH environment variable.", "https://aka.ms/azTerraform-requirement");
    }
}
