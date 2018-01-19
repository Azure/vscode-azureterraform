"use strict";

import * as vscode from "vscode";

import { join } from "path";
import { commands, Disposable, extensions, Uri, ViewColumn, window, workspace, WorkspaceEdit } from "vscode";

import { BaseShell } from "./baseShell";
import { Constants } from "./constants";
import { TerminalType, TFTerminal } from "./shared";
import { isDockerInstalled, isEmpty, localExecCmd } from "./utilities";

import fs = require("fs-extra");

export class IntegratedShell extends BaseShell {
    private static readonly GRAPH_FILE_NAME = "./graph.png";

    // terminal wrapper
    public term = new TFTerminal(
        TerminalType.Integrated,
        Constants.TerraformTerminalName);

    private graphUri: Uri;

    // Creates a png of terraform resource graph to visualize the resources under management.
    public visualize(): void {
        this.deletePng();

        const cp = require("child_process");
        const child = cp.spawnSync("terraform init && terraform graph | dot -Tpng -o graph.png", {
            stdio: "pipe",
            shell: true,
            cwd: vscode.workspace.workspaceFolders[0].uri.fsPath,
        });
        if (child.stderr.length > 0) {
            // some error occured, dump to output channel and exit visualize.
            this.outputChannel.append(child.stdout);
            vscode.window.showErrorMessage("An error has occured, the visualization file could not be generated");
            return;
        } else {
            this.displayPng();
            console.log(`Vizualization rendering complete in ${vscode.workspace.workspaceFolders[0].uri.fsPath}`);
        }
    }

    // init shell env and hook up close handler. Close handler ensures if user closes terminal window,
    // that extension is notified and can handle appropriately.
    protected initShellInternal() {
        // set path for
        this.graphUri = Uri.file(join(workspace.rootPath || "", IntegratedShell.GRAPH_FILE_NAME));

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
        const containerName: string = vscode.workspace.getConfiguration("tf-azure").get("test-container");

        // Check if the environment variables are set locally
        this.outputChannel.appendLine("Checking SPN environment variables\n");
        /* tslint:disable:no-string-literal */
        if (isEmpty(process.env["ARM_SUBSCRIPTION_ID"] ||
            process.env["ARM_CLIENT_ID"] ||
            process.env["ARM_CLIENT_SECRET"] ||
            process.env["ARM_TENANT_ID"] ||
            process.env["ARM_TEST_LOCATION"] ||
            process.env["ARM_TEST_LOCATION_ALT"])) {
            vscode.window.showErrorMessage(
                "Azure Service Principal is not set (See documentation at: " +
                "https://docs.microsoft.com/en-us/cli/azure/ad/sp?view=azure-cli-latest#az_ad_sp_create_for_rbac)");
            return;
        }
        /* tslint:enable:no-string-literal */

        // We need to check if Docker is installed before we run the command
        const outputChannel = this.outputChannel;
        isDockerInstalled(outputChannel, (err) => {
            if (err) {
                console.log("Docker not installed");
            } else {
                console.log("Docker is installed - running the test");

                // Let"s run the test, it will pull the container is not already there.
                switch (TestType) {
                    case "lint": {
                        localExecCmd("docker", [
                            "run",
                            "-v",
                            vscode.workspace.workspaceFolders[0].uri.fsPath + ":/tf-test/module",
                            "--rm",
                            containerName,
                            "rake",
                            "-f",
                            "../Rakefile",
                            "build"],
                            outputChannel,
                            (e) => {
                                if (e) {
                                    console.log("Error running the lint test: " + e);
                                } else {
                                    console.log("Lint test ran successfully");
                                }
                                return;
                            });
                        break;
                    }
                    case "e2e - no ssh": {
                        console.log("Running e2e test in " + process.env["ARM_TEST_LOCATION"]);
                        localExecCmd("docker", ["run", "-v",
                            vscode.workspace.workspaceFolders[0].uri.fsPath + "/logs:/tf-test/module.kitchen",
                            "-v", vscode.workspace.workspaceFolders[0].uri.fsPath + ":/tf-test/module",
                            "-e", "ARM_CLIENT_ID", "-e", "ARM_TENANT_ID", "-e", "ARM_SUBSCRIPTION_ID", "-e",
                            "ARM_CLIENT_SECRET", "-e", "ARM_TEST_LOCATION", "-e", "ARM_TEST_LOCATION_ALT",
                            "--rm", containerName, "rake", "-f", "../Rakefile",
                            "e2e"], outputChannel, (e) => {
                                if (e) {
                                    console.log("Error running the end to end test: " + e);
                                } else {
                                    console.log("End to end test ran successfully");
                                }
                                return;
                            });
                        break;
                    }
                    case "e2e - with ssh": {
                        console.log("Running e2e test in " + process.env["ARM_TEST_LOCATION"]);
                        localExecCmd("docker", ["run", "-v", "~/.ssh:/root/.ssh/", "-v",
                            vscode.workspace.workspaceFolders[0].uri.fsPath + "/logs:/tf-test/module.kitchen",
                            "-v", vscode.workspace.workspaceFolders[0].uri.fsPath + ":/tf-test/module",
                            "-e", "ARM_CLIENT_ID", "-e", "ARM_TENANT_ID", "-e", "ARM_SUBSCRIPTION_ID",
                            "-e", "ARM_CLIENT_SECRET", "-e", "ARM_TEST_LOCATION", "-e", "ARM_TEST_LOCATION_ALT",
                            "--rm", containerName, "rake", "-f", "../Rakefile", "e2e"],
                            outputChannel, (e) => {
                                if (e) {
                                    console.log("Error running the end to end test: " + e);
                                } else {
                                    console.log("End to end test ran successfully");
                                }
                                return;
                            });
                        break;
                    }
                    case "custom": {
                        console.log("Running custom test in " + process.env["ARM_TEST_LOCATION"]);
                        console.log(vscode.window.showInputBox({
                            prompt: "Type your custom test command",
                            value: "run -v " + vscode.workspace.workspaceFolders[0].uri.fsPath +
                                ":/tf-test/module --rm " + containerName + " rake -f ../Rakefile build",
                        }).then((cmd) =>
                            localExecCmd("docker", cmd.split(" "), outputChannel, (e) => {
                                if (e) {
                                    console.log("Error running the custom test: " + e);
                                } else {
                                    console.log("Custom test ran successfully");
                                }
                                return;
                            }),
                        ));
                        break;
                    }
                    default: {
                        console.log("Default step in test for Integrated Terminal");
                        break;
                    }
                }
            }
        });

    }

    protected syncWorkspaceInternal() {
        // not implemented for integrated terminal
        return;
    }

    private deletePng(): void {
        if (fs.existsSync(this.graphUri.path)) {
            fs.unlinkSync(this.graphUri.path);
        }
    }

    private displayPng(): void {
        // add 2 second delay before opening file due to file creation latency
        setTimeout(() => { commands.executeCommand("vscode.open", this.graphUri, ViewColumn.Two); }
            , 2000);
    }

    private checkCreateTerminal(): void {
        if (this.term.terminal == null) {
            this.term.terminal = vscode.window.createTerminal(
                Constants.TerraformTerminalName);
        }
    }

}
