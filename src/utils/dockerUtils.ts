"use strict";

import * as vscode from "vscode";
import { executeCommand } from "./cpUtils";

export async function validateDockerInstalled(): Promise<void> {
    try {
        await executeCommand(undefined, {shell: true}, "docker", "-v");
    } catch (error) {
        throw new Error("Docker isn't installed, please install Docker to continue (https://www.docker.com/)");
    }
}

export async function runLintInDocker(outputChannel: vscode.OutputChannel, volumn: string, containerName: string): Promise<void> {
    try {
        await executeCommand(
            outputChannel,
            {shell: true},
            "docker",
            "run",
            "-v",
            volumn,
            "--rm",
            containerName,
            "rake",
            "-f",
            "../Rakefile",
            "build",
        );
    } catch (error) {
        throw new Error("Run lint task in Docker failed, Please switch to output channel for more details.");
    }
}

export async function runE2EInDocker(outputChannel: vscode.OutputChannel, volumn: string[], containerName: string): Promise<void> {
    try {
        await executeCommand(
            outputChannel,
            {shell: true},
            "docker",
            "run",
            ...insertElementIntoArray(volumn, "-v"),
            "-e", "ARM_CLIENT_ID",
            "-e", "ARM_TENANT_ID",
            "-e", "ARM_SUBSCRIPTION_ID",
            "-e", "ARM_CLIENT_SECRET",
            "-e", "ARM_TEST_LOCATION",
            "-e", "ARM_TEST_LOCATION_ALT",
            "--rm",
            containerName,
            "rake",
            "-f",
            "../Rakefile",
            "e2e",
        );
    } catch (error) {
        throw new Error("Run E2E test in Docker failed, Please switch to output channel for more details.");
    }
}

// usage: insertElementIntoArray([1, 2], 0) => [0, 1, 0, 2]
function insertElementIntoArray(array: any[], element: any): any[] {
    return array.reduce((pre, cur) => pre.concat(element, cur), []);
}
