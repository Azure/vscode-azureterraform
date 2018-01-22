"use strict";

import * as vscode from "vscode";
import { executeCommand } from "./cpUtils";

export async function validateDotInstalled(): Promise<void> {
    try {
        await executeCommand(undefined, {shell: true}, "dot", "-V");
    } catch (error) {
        throw new Error("GraphViz - Dot is not installed, please install GraphViz to continue (https://www.graphviz.org).");
    }
}
