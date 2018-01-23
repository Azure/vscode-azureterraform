"use strict";

import * as fse from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { commands, Uri, ViewColumn, workspace } from "vscode";
import { BaseShell } from "./baseShell";
import { Constants } from "./constants";
import { TerminalType, TFTerminal } from "./shared";
import { TestOption } from "./utilities";
import { executeCommand } from "./utils/cpUtils";
import { isDockerInstalled, isServicePrincipalSetInEnv, runE2EInDocker, runLintInDocker } from "./utils/dockerUtils";
import { drawGraph } from "./utils/dotUtils";

export class IntegratedShell extends BaseShell {
    private static readonly GRAPH_FILE_NAME = "./graph.png";

    // terminal wrapper
    public term = new TFTerminal(
        TerminalType.Integrated,
        Constants.TerraformTerminalName);

    private graphUri: Uri;

    // Creates a png of terraform resource graph to visualize the resources under management.
    public async visualize(outputChannel: vscode.OutputChannel): Promise<void> {
        await this.deletePng();

        await executeCommand(
            "terraform",
            ["init"],
            {
                shell: true,
                cwd: vscode.workspace.workspaceFolders[0].uri.fsPath,
            },
            outputChannel,
        );
        const output: string = await executeCommand(
            "terraform",
            ["graph"],
            {
                shell: true,
                cwd: vscode.workspace.workspaceFolders[0].uri.fsPath,
            },
            outputChannel,
        );
        const tmpFile: string = path.join(os.tmpdir(), "terraformgraph.output");
        await fse.writeFile(tmpFile, output);
        await drawGraph(outputChannel, vscode.workspace.workspaceFolders[0].uri.fsPath, tmpFile);
        await commands.executeCommand("vscode.open", this.graphUri, ViewColumn.Two);
    }

    // init shell env and hook up close handler. Close handler ensures if user closes terminal window,
    // that extension is notified and can handle appropriately.
    protected initShellInternal() {
        // set path for
        this.graphUri = Uri.file(path.join(workspace.rootPath || "", IntegratedShell.GRAPH_FILE_NAME));

        if ("onDidCloseTerminal" in vscode.window as any) {
            (vscode.window as any).onDidCloseTerminal((terminal) => {
                if (terminal === this.term.terminal) {
                    this.outputLine("Terraform Terminal closed", terminal.name);
                    this.term.terminal = null;
                }
            });
        }
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

        this.outputChannel.appendLine("Checking Azure Service Principal environment variables...");
        if (!isServicePrincipalSetInEnv()) {
            return;
        }

        switch (TestType) {
            case TestOption.lint: {
                await runLintInDocker(
                    this.outputChannel,
                    vscode.workspace.workspaceFolders[0].uri.fsPath + ":/tf-test/module",
                    containerName,
                );
                break;
            }
            case TestOption.e2enossh: {
                console.log("Running e2e test in " + process.env["ARM_TEST_LOCATION"]);
                await runE2EInDocker(
                    this.outputChannel,
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
                    this.outputChannel,
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
                        this.outputChannel,
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

    private async deletePng(): Promise<void> {
        if (await fse.pathExists(this.graphUri.path)) {
            await fse.remove(this.graphUri.path);
        }
    }

    private checkCreateTerminal(): void {
        if (this.term.terminal == null) {
            this.term.terminal = vscode.window.createTerminal(
                Constants.TerraformTerminalName);
        }
    }

}
