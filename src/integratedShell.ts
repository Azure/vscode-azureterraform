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
import { isDockerInstalled, runE2EInDocker, runLintInDocker } from "./utils/dockerUtils";
import { drawGraph } from "./utils/dotUtils";
import { selectWorkspaceFolder } from "./utils/workspaceUtils";

export class IntegratedShell extends BaseShell {
    private static readonly GRAPH_FILE_NAME = "graph.png";

    // terminal wrapper
    public term = new TFTerminal(TerminalType.Integrated, Constants.TerraformTerminalName);

    // Creates a png of terraform resource graph to visualize the resources under management.
    public async visualize(): Promise<void> {
        const cwd: string = (await selectWorkspaceFolder()).uri.fsPath;
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

    // init shell env and hook up close handler. Close handler ensures if user closes terminal window,
    // that extension is notified and can handle appropriately.
    protected initShellInternal() {
        vscode.window.onDidCloseTerminal((terminal) => {
            if (terminal === this.term.terminal) {
                terraformChannel.appendLine("Terraform Terminal closed", terminal.name);
                this.term.terminal = null;
            }
        });
    }

    protected runTerraformInternal(TFCommand: string, WorkDir: string): void {
        this.checkCreateTerminal();
        const term = this.term.terminal;
        term.show();
        term.sendText(TFCommand);
        return;
    }

    // run tf cmd async and return promise.
    protected runTerraformAsyncInternal(TFConfiguration: string, TFCommand: string): Promise<any> {
        this.checkCreateTerminal();

        const term = this.term.terminal;

        term.show();

        const ret = term.sendText(TFCommand);
        return Promise.all([ret]);
    }

    protected async runTerraformTestsInternal(TestType: string) {
        if (!await isDockerInstalled()) {
            return;
        }
        const containerName: string = vscode.workspace.getConfiguration("tf-azure").get("test-container");

        terraformChannel.appendLine("Checking Azure Service Principal environment variables...");
        if (!isServicePrincipalSetInEnv()) {
            return;
        }

        switch (TestType) {
            case TestOption.lint: {
                await runLintInDocker(
                    vscode.workspace.workspaceFolders[0].uri.fsPath + ":/tf-test/module",
                    containerName,
                );
                break;
            }
            case TestOption.e2enossh: {
                console.log("Running e2e test in " + process.env["ARM_TEST_LOCATION"]);
                await runE2EInDocker(
                    [
                        vscode.workspace.workspaceFolders[0].uri.fsPath + "/logs:/tf-test/module.kitchen",
                        vscode.workspace.workspaceFolders[0].uri.fsPath + ":/tf-test/module",
                    ],
                    containerName,
                );
                break;
            }
            case TestOption.e2ewithssh: {
                console.log("Running e2e test in " + process.env["ARM_TEST_LOCATION"]);
                await runE2EInDocker(
                    [
                        `${path.join(os.homedir(), ".ssh")}:/root/.ssh/`,
                        vscode.workspace.workspaceFolders[0].uri.fsPath + "/logs:/tf-test/module.kitchen",
                        vscode.workspace.workspaceFolders[0].uri.fsPath + ":/tf-test/module",
                    ],
                    containerName,
                );
                break;
            }
            case TestOption.custom: {
                console.log("Running custom test in " + process.env["ARM_TEST_LOCATION"]);
                const cmd: string = await vscode.window.showInputBox({
                    prompt: "Type your custom test command",
                    value: `run -v ${vscode.workspace.workspaceFolders[0].uri.fsPath}:/tf-test/module --rm ${containerName} rake -f ../Rakefile build`,
                });
                if (cmd) {
                    await executeCommand(
                        "docker",
                        cmd.split(" "),
                        { shell: true },
                    );
                }
                break;
            }
            default: {
                console.log("Default step in test for Integrated Terminal");
                break;
            }
        }
    }

    protected syncWorkspaceInternal() {
        // not implemented for integrated terminal
        return;
    }

    private async deletePng(cwd: string): Promise<void> {
        const graphPath: string = path.join(cwd, IntegratedShell.GRAPH_FILE_NAME);
        if (await fse.pathExists(graphPath)) {
            await fse.remove(graphPath);
        }
    }

    private checkCreateTerminal(): void {
        if (!this.term.terminal) {
            this.term.terminal = vscode.window.createTerminal(Constants.TerraformTerminalName);
        }
    }
}
