"use strict";

import * as vscode from 'vscode';
import { Constants } from "./constants";
import * as path from "path";
import { isEmpty, isDockerInstalled } from './utilities';
import { CloudShell } from './cloudShell';

export abstract class BaseShell {
    protected _outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this._outputChannel = outputChannel;
        this.initShellInternal();
    }

    protected output(label: string, message: string): void {
        this._outputChannel.append(`[${label}] ${message}`);
    }

    protected outputLine(label: string, message: string): void {
        this._outputChannel.appendLine(`[${label}] ${message}`);
    }

    protected isWindows(): boolean {
        return process.platform === 'win32';
    }

    public runTerraformCmd(TFCommand: string): void {
        // We keep the TFConfiguration for the moment - will need to be updated to sync folders
        var TFConfiguration = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
        this._outputChannel.append("Starting Cloudshell - Terraform \n")

        // Open Cloud Console 
        

        // Sync files to cloudshell

        // Run Terraform command 
        this.runTerraformInternal("", "");

        // return this.runTerraformInternal(TFConfiguration, TFCommand);

    }

    public async runTerraformCmdAsync(TFCommand: string): Promise<any> {
        var TFConfiguration = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
        this._outputChannel.append("Starting Cloudshell - Terraform")
        this._outputChannel.show();

        return this.runTerraformAsyncInternal(TFConfiguration, TFCommand);
    }

    // Method used to run the end to end tests 
    public async runTerraformTests(test: string): Promise<any> {

        // Check the environment variables 
        console.log('Checking environment variables');

        if (isEmpty(process.env['ARM_SUBSCRIPTION_ID'] ||
            process.env['ARM_CLIENT_ID'] ||
            process.env['ARM_CLIENT_SECRET'] ||
            process.env['ARM_TENANT_ID'] ||
            process.env['ARM_TEST_LOCATION'] ||
            process.env['ARM_TEST_LOCATION_ALT'])) {
            vscode.window.showErrorMessage('Azure Service Principal is not set');
            return;
        }

        return this.runTerraformTestsInternal(test);


    }

    //protected abstract runPlaybookInternal(playbook: string);
    protected abstract runTerraformInternal(TFConfiguration: string, TFCommand: string);
    protected abstract runTerraformAsyncInternal(TFConfiguration: string, TFCommand: string): Promise<any>;
    protected abstract initShellInternal();
    protected abstract syncWorkspaceInternal();
    protected abstract runTerraformTestsInternal(TestType: string);

}
