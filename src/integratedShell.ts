"use strict";

import * as vscode from 'vscode';
import { BaseShell } from './baseShell';
import { isDockerInstalled, localExecCmd } from './utilities'
import { join } from 'path';
import { extensions, commands, workspace, Disposable, Uri, window, ViewColumn, WorkspaceEdit } from 'vscode';
import { TFTerminal, TerminalType } from './shared'
import { Constants } from './constants'
const fs = require('fs-extra')

export class IntegratedShell extends BaseShell {
    static readonly GRAPH_FILE_NAME = './graph.png';
    private graphUri: Uri;

    //terminal wrapper
    public term = new TFTerminal(
        TerminalType.Integrated,
        Constants.TerraformTerminalName);

    //init shell env and hook up close handler. Close handler ensures if user closes terminal window, 
    // that extension is notified and can handle appropriately.
    protected initShellInternal() {
        //set path for 
        this.graphUri = Uri.file(join(workspace.rootPath || '', IntegratedShell.GRAPH_FILE_NAME));

        if ('onDidCloseTerminal' in <any>vscode.window) {
            (<any>vscode.window).onDidCloseTerminal((terminal) => {
                if (terminal == this.term.terminal) {
                    this.outputLine('Terraform Terminal closed', terminal.name);
                    this.term.terminal = null;
                }
            });
        }
    }

    protected runTerraformInternal(TFCommand: string): void {
        this.checkCreateTerminal();
        var term = this.term.terminal;
        term.show();
        term.sendText(TFCommand);
        return;
    }

    //run tf cmd async and return promise.
    protected runTerraformAsyncInternal(TFConfiguration: string, TFCommand: string): Promise<any> {
        this.checkCreateTerminal();

        var term = this.term.terminal;

        term.show();

        let ret = term.sendText(TFCommand);
        return Promise.all([ret]);
    }

    protected async runTerraformTestsInternal(TestType: string) {
        // The environment variables have been checked before
        // We need to check if Docker is installed before we run the command

        const outputChannel = this._outputChannel
        isDockerInstalled(outputChannel, function (err) {
            if (err) {
                console.log('Docker not installed');
            }
            else {
                console.log('Docker is installed - running the test');
                // Let's run the test, it will pull the container is not already there.
                // 
                switch (TestType) {
                    case "lint": {
                        localExecCmd('docker', ['run', '-v', vscode.workspace.workspaceFolders[0].uri.fsPath + ':/tf-test/module', '--rm', 'microsoft/terraform-test', 'rake', '-f', '../Rakefile', 'build'], outputChannel, function (err) {
                            if (err) {
                                console.log('Error running the lint test: ' + err);
                            }
                            else {
                                console.log('Lint test ran successfully');
                            }
                            return;
                        })
                        break;
                    }
                    case "e2e - no ssh": {
                        console.log('Running e2e test in ' + process.env['ARM_TEST_LOCATION']);
                        localExecCmd('docker', ['run', '-v', vscode.workspace.workspaceFolders[0].uri.fsPath + '/logs:/tf-test/module.kitchen',
                            '-v', vscode.workspace.workspaceFolders[0].uri.fsPath + ':/tf-test/module',
                            '-e', 'ARM_CLIENT_ID', '-e', 'ARM_TENANT_ID', '-e', 'ARM_SUBSCRIPTION_ID', '-e', 'ARM_CLIENT_SECRET', '-e', 'ARM_TEST_LOCATION', '-e', 'ARM_TEST_LOCATION_ALT',
                            '--rm', 'microsoft/terraform-test', 'rake', '-f', '../Rakefile', 'e2e'], outputChannel, function (err) {
                                if (err) {
                                    console.log('Error running the end to end test: ' + err);
                                }
                                else {
                                    console.log('End to end test ran successfully');
                                }
                                return;
                            })
                        break;
                    }
                    case "e2e - with ssh": {
                        console.log('Running e2e test in ' + process.env['ARM_TEST_LOCATION']);
                        localExecCmd('docker', ['run', '-v', '~/.ssh:/root/.ssh/', '-v', vscode.workspace.workspaceFolders[0].uri.fsPath + '/logs:/tf-test/module.kitchen',
                            '-v', vscode.workspace.workspaceFolders[0].uri.fsPath + ':/tf-test/module',
                            '-e', 'ARM_CLIENT_ID', '-e', 'ARM_TENANT_ID', '-e', 'ARM_SUBSCRIPTION_ID', '-e', 'ARM_CLIENT_SECRET', '-e', 'ARM_TEST_LOCATION', '-e', 'ARM_TEST_LOCATION_ALT',
                            '--rm', 'microsoft/terraform-test', 'rake', '-f', '../Rakefile', 'e2e'], outputChannel, function (err) {
                                if (err) {
                                    console.log('Error running the end to end test: ' + err);
                                }
                                else {
                                    console.log('End to end test ran successfully');
                                }
                                return;
                            })
                        break;
                    }
                    case "custom": {
                        console.log('Running custom test in ' + process.env['ARM_TEST_LOCATION']);
                        console.log(vscode.window.showInputBox({ prompt: "Type your custom test command", value: "run -v " + vscode.workspace.workspaceFolders[0].uri.fsPath + ":/tf-test/module --rm microsoft/terraform-test rake -f ../Rakefile build" }).then(cmd =>
                            localExecCmd('docker', cmd.split(" "), outputChannel, function (err) {
                                if (err) {
                                    console.log('Error running the custom test: ' + err);
                                }
                                else {
                                    console.log('Custom test ran successfully');
                                }
                                return;
                            })
                        ));
                        break;
                    }
                    default: {
                        console.log("default step in test");
                        break;
                    }
                }
            }
        });

    }

    public visualize(): void {
        this.deletePng();
        var output;

        const cp = require('child_process');
        const child = cp.spawnSync('terraform init && terraform graph | dot -Tpng -o graph.png', {
            stdio: 'pipe',
            shell: true,
            cwd: vscode.workspace.workspaceFolders[0].uri.fsPath
        });
        if (child.stderr.length > 0) {
            //some error occured, dump to output channel and exit visualize.
            this._outputChannel.append(child.stdout);
            return;
        }
        else {
            this.displayPng();
            console.log(`Vizualization rendering complete in ${vscode.workspace.workspaceFolders[0].uri.fsPath}`);
        }
    }

    private deletePng(): void {
        if (fs.existsSync(this.graphUri.path)) {
            fs.unlinkSync(this.graphUri.path)
        }
    }

    private displayPng(): void {
        //add 2 second delay before opening file due to file creation latency
        setTimeout(() => { commands.executeCommand('vscode.open', this.graphUri, ViewColumn.Two); }
            , 2000);
    }

    protected syncWorkspaceInternal() {
        //not implemented for integrated terminal
    }

    protected async uploadTFFiles(TFFiles) {
    }

    private checkCreateTerminal(): void {
        if (this.term.terminal == null) {
            this.term.terminal = vscode.window.createTerminal(
                Constants.TerraformTerminalName);
        }
    }



}

