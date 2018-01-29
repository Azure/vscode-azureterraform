"use strict";

import { executeCommand } from "./cpUtils";
import { openUrlHint } from "./uiUtils";

export async function isDotInstalled(): Promise<boolean> {
    try {
        await executeCommand("dot", ["-V"], { shell: true });
        return true;
    } catch (error) {
        openUrlHint("GraphViz - Dot is not installed, please install GraphViz to continue.", "https://www.graphviz.org");
        return false;
    }
}

export async function drawGraph(workingDirectory: string, inputFile: string): Promise<void> {
    await executeCommand(
        "dot",
        ["-Tpng", "-o", "graph.png", inputFile],
        {
            cwd: workingDirectory,
            shell: true,
        },
    );
}
