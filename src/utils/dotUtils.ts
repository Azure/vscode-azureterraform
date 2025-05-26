/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import { executeCommand } from "./cpUtils";
import { openUrlHint } from "./uiUtils";

export async function isDotInstalled(): Promise<boolean> {
  try {
    await executeCommand("dot", ["-V"], { shell: true });
    return true;
  } catch (error) {
    openUrlHint(
      "GraphViz is not installed, please make sure GraphViz is in the PATH environment variable.",
      "https://aka.ms/azTerraform-requirement"
    );
    return false;
  }
}

export async function drawGraph(
  workingDirectory: string,
  inputFile: string
): Promise<void> {
  await executeCommand("dot", ["-Tpng", "-o", "graph.png", inputFile], {
    cwd: workingDirectory,
    shell: true,
  });
}
