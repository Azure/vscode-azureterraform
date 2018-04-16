/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import * as fse from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { commands, Uri, ViewColumn } from "vscode";
import { TelemetryWrapper } from "vscode-extension-telemetry-wrapper";
import { BaseShell } from "./baseShell";
import { Constants } from "./constants";
import { TestOption } from "./shared";
import { terraformChannel } from "./terraformChannel";
import { isServicePrincipalSetInEnv } from "./utils/azureUtils";
import { executeCommand } from "./utils/cpUtils";
import { isDockerInstalled, runCustomCommandInDocker, runE2EInDocker, runLintInDocker } from "./utils/dockerUtils";
import { drawGraph } from "./utils/dotUtils";
import { isDotInstalled } from "./utils/dotUtils";
import * as settingUtils from "./utils/settingUtils";
import { DialogType, promptForOpenOutputChannel } from "./utils/uiUtils";
import { selectWorkspaceFolder } from "./utils/workspaceUtils";

export class IntegratedShell extends BaseShell {
    private static readonly GRAPH_FILE_NAME = "graph.png";

    // Creates a png of terraform resource graph to visualize the resources under management.
    public async visualize(): Promise<void> {
        if (!await isDotInstalled()) {
            TelemetryWrapper.error("dotNotInstalled");
            return;
        }
        const cwd: string = await selectWorkspaceFolder();
        if (!cwd) {
            TelemetryWrapper.error("noWorkspaceSelected");
            return;
        }
        await this.deletePng(cwd);
        await executeCommand(
            "terraform",
            ["init"],
            {
                shell: true,
                cwd,
            },
        );
        const output: string = await executeCommand(
            "terraform",
            ["graph"],
            {
                shell: true,
                cwd,
            },
        );
        const tmpFile: string = path.join(os.tmpdir(), "terraformgraph.output");
        await fse.writeFile(tmpFile, output);
        await drawGraph(cwd, tmpFile);
        await commands.executeCommand("vscode.open", Uri.file(path.join(cwd, IntegratedShell.GRAPH_FILE_NAME)), ViewColumn.Two);
    }

    public async runTerraformTests(TestType: string, workingDirectory: string) {
        if (!await isDockerInstalled()) {
            TelemetryWrapper.error("dockerNotInstalled");
            return;
        }
        const containerName: string = settingUtils.getImageNameForTest();

        terraformChannel.appendLine("Checking Azure Service Principal environment variables...");
        if (!isServicePrincipalSetInEnv()) {
            TelemetryWrapper.error("servicePrincipalEnvInvalid");
            return;
        }

        let executeResult: boolean = false;
        switch (TestType) {
            case TestOption.lint:
                executeResult = await runLintInDocker(
                    workingDirectory + ":/tf-test/module",
                    containerName,
                );
                break;
            case TestOption.e2e:
                executeResult = await runE2EInDocker(
                    workingDirectory + ":/tf-test/module",
                    containerName,
                );
                break;

            case TestOption.custom:
                const cmd: string = await vscode.window.showInputBox({
                    prompt: "Type your custom test command",
                    value: `run -v ${workingDirectory}:/tf-test/module --rm ${containerName} rake -f ../Rakefile build`,
                });
                if (!cmd) {
                    return;
                }
                executeResult = await runCustomCommandInDocker(cmd, containerName);
                break;
            default:
                break;
        }
        if (executeResult) {
            await promptForOpenOutputChannel("The tests finished. Please open the output channel for more details.", DialogType.info);
        }
    }

    public runTerraformCmd(tfCommand: string): void {
        this.checkCreateTerminal();
        this.terminal.show();
        this.terminal.sendText(tfCommand);
    }

    protected initShellInternal() {
        vscode.window.onDidCloseTerminal((terminal) => {
            if (terminal === this.terminal) {
                this.dispose();
            }
        });
    }

    private async deletePng(cwd: string): Promise<void> {
        const graphPath: string = path.join(cwd, IntegratedShell.GRAPH_FILE_NAME);
        if (await fse.pathExists(graphPath)) {
            await fse.remove(graphPath);
        }
    }

    private checkCreateTerminal(): void {
        if (!this.terminal) {
            this.terminal = vscode.window.createTerminal(Constants.TerraformTerminalName);
        }
    }
}
