"use strict";

import * as fse from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { commands, Uri, ViewColumn } from "vscode";
import { BaseShell } from "./baseShell";
import { Constants } from "./constants";
import { TerminalType, TestOption, TFTerminal } from "./shared";
import { terraformChannel } from "./terraformChannel";
import { isServicePrincipalSetInEnv } from "./utils/azureUtils";
import { executeCommand } from "./utils/cpUtils";
import { isDockerInstalled, runCustomCommandInDocker, runE2EInDocker, runLintInDocker } from "./utils/dockerUtils";
import { drawGraph } from "./utils/dotUtils";
import { isDotInstalled } from "./utils/dotUtils";
import { DialogType, promptForOpenOutputChannel } from "./utils/uiUtils";
import { selectWorkspaceFolder } from "./utils/workspaceUtils";

export class IntegratedShell extends BaseShell {
    private static readonly GRAPH_FILE_NAME = "graph.png";

    // Creates a png of terraform resource graph to visualize the resources under management.
    public async visualize(): Promise<void> {
        if (!await isDotInstalled()) {
            return;
        }
        const cwd: string = await selectWorkspaceFolder();
        if (!cwd) {
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
            return;
        }
        const containerName: string = vscode.workspace.getConfiguration("tf-azure").get("test-container");

        terraformChannel.appendLine("Checking Azure Service Principal environment variables...");
        if (!isServicePrincipalSetInEnv()) {
            return;
        }

        let executeResult: boolean;
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
                console.log("Default step in test for Integrated Terminal");
                break;
        }
        if (executeResult) {
            await promptForOpenOutputChannel("The tests finished. Please open the output channel for more details.", DialogType.info);
        }
    }

    public runTerraformCmd(tfCommand: string): void {
        this.checkCreateTerminal();
        const term = this.tfTerminal.terminal;
        term.show();
        term.sendText(tfCommand);
    }

    protected initShellInternal() {
        this.tfTerminal = new TFTerminal(TerminalType.Integrated, Constants.TerraformTerminalName);
        vscode.window.onDidCloseTerminal((terminal) => {
            if (terminal === this.tfTerminal.terminal) {
                terraformChannel.appendLine("Terraform Terminal closed", terminal.name);
                this.tfTerminal.terminal = null;
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
        if (!this.tfTerminal.terminal) {
            this.tfTerminal.terminal = vscode.window.createTerminal(Constants.TerraformTerminalName);
        }
    }
}
