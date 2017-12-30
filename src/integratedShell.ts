"use strict";

import * as vscode from 'vscode';
import { BaseShell } from './baseShell';
import { extensions, commands, Disposable, window } from 'vscode';
import { TFTerminal, TerminalType } from './shared'
import { Constants } from './constants'
import { isDockerInstalled, localExecCmd } from './utilities'


export class IntegratedShell extends BaseShell {

    protected iTerm = new TFTerminal(
        TerminalType.Integrated,
        Constants.TerraformTerminalName);

    protected initShellInternal() {
        if ('onDidCloseTerminal' in <any>vscode.window) {
            (<any>vscode.window).onDidCloseTerminal((terminal) => {
                if (terminal == this.iTerm.terminal) {
                    this.outputLine('Terraform Terminal closed', terminal.name);
                    this.iTerm.terminal = null;
                }
            });
        }
    }

    protected runTerraformInternal(TFCommand: string): void {
        this.checkCreateTerminal();

        var term = this.iTerm.terminal;

        term.show();
        term.sendText(TFCommand);
        return;
    }


    protected runTerraformAsyncInternal(TFConfiguration: string, TFCommand: string): Promise<any> {
        this.checkCreateTerminal();

        var term = this.iTerm.terminal;

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
                                console.log('Error running the lint test: '+ err);}
                            else {
                                console.log('Lint test ran successfully');}
                        })
                    }
                    case "e2e - no ssh": {
                        console.log('Running e2e test in '+process.env['ARM_TEST_LOCATION']);
                        localExecCmd('docker', ['run', '-v', vscode.workspace.workspaceFolders[0].uri.fsPath + '/logs:/tf-test/module.kitchen', 
                                                '-v', vscode.workspace.workspaceFolders[0].uri.fsPath + ':/tf-test/module',
                                                '-e', 'ARM_CLIENT_ID', '-e', 'ARM_TENANT_ID', '-e', 'ARM_SUBSCRIPTION_ID', '-e', 'ARM_CLIENT_SECRET', '-e', 'ARM_TEST_LOCATION', '-e', 'ARM_TEST_LOCATION_ALT',
                                                '--rm', 'microsoft/terraform-test', 'rake', '-f', '../Rakefile', 'e2e'], outputChannel, function (err) {
                            if (err) {
                                console.log('Error running the end to end test: '+ err);}
                            else {
                                console.log('End to end test ran successfully');}
                        })
                    }
                    case "e2e - with ssh": {
                        console.log('Running e2e test in '+process.env['ARM_TEST_LOCATION']);
                        localExecCmd('docker', ['run', '-v', '~/.ssh:/root/.ssh/', '-v', vscode.workspace.workspaceFolders[0].uri.fsPath + '/logs:/tf-test/module.kitchen', 
                                                '-v', vscode.workspace.workspaceFolders[0].uri.fsPath + ':/tf-test/module',
                                                '-e', 'ARM_CLIENT_ID', '-e', 'ARM_TENANT_ID', '-e', 'ARM_SUBSCRIPTION_ID', '-e', 'ARM_CLIENT_SECRET', '-e', 'ARM_TEST_LOCATION', '-e', 'ARM_TEST_LOCATION_ALT',
                                                '--rm', 'microsoft/terraform-test', 'rake', '-f', '../Rakefile', 'e2e'], outputChannel, function (err) {
                            if (err) {
                                console.log('Error running the end to end test: '+ err);}
                            else {
                                console.log('End to end test ran successfully');}
                        })
                    }
                    case "custom": {
                        console.log('Running custom test in '+process.env['ARM_TEST_LOCATION']);
                        console.log(vscode.window.showInputBox({prompt: "Type your custom test command", value: "run -v " + vscode.workspace.workspaceFolders[0].uri.fsPath + ":/tf-test/module --rm microsoft/terraform-test rake -f ../Rakefile build"}).then( cmd =>
                            localExecCmd('docker', cmd.split(" "), outputChannel, function (err) {
                                if (err) {
                                    console.log('Error running the custom test: '+ err);}
                                else {
                                    console.log('Custom test ran successfully');}
                            })
                        ));

                    }
                }
            }
        });

    }

    protected syncWorkspaceInternal() {
        //not implemented for integrated terminal
    }

    protected async uploadTFFiles(TFFiles){
    }

    private checkCreateTerminal(): void {

        if (this.iTerm.terminal == null) {
            this.iTerm.terminal = vscode.window.createTerminal(
                Constants.TerraformTerminalName);
        }
    }



}

