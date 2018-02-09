"use strict";

import { executeCommand } from "./cpUtils";
import { DialogType, openUrlHint, promptForOpenOutputChannel } from "./uiUtils";

export async function isDockerInstalled(): Promise<boolean> {
    try {
        await executeCommand("docker", ["-v"], { shell: true });
        return true;
    } catch (error) {
        openUrlHint("Docker is not installed, please install Docker to continue.", "https://www.docker.com");
        return false;
    }
}

export async function latestTestingImagePulled(): Promise<boolean> {
    try {
        await executeCommand("docker", ["pull", "microsoft/terraform-test:latest"], { shell: true });
        return true;
    } catch (error) {
        promptForOpenOutputChannel("Failed to pull the latest image: microsoft/terraform-test. Please open the output channel for more details.", DialogType.error);
        return false;
    }
}

export async function runLintInDocker(volumn: string, containerName: string): Promise<void> {
    try {
        await executeCommand(
            "docker",
            [
                "run",
                "-v",
                volumn,
                "--rm",
                containerName,
                "rake",
                "-f",
                "../Rakefile",
                "build",
            ],
            { shell: true },
        );
    } catch (error) {
        promptForOpenOutputChannel("Failed to run lint task in Docker. Please open the output channel for more details.", DialogType.error);
    }
}

export async function runE2EInDocker(volumn: string, containerName: string): Promise<void> {
    try {
        await executeCommand(
            "docker",
            [
                "run",
                "-v",
                volumn,
                "-e",
                "ARM_CLIENT_ID",
                "-e",
                "ARM_TENANT_ID",
                "-e",
                "ARM_SUBSCRIPTION_ID",
                "-e",
                "ARM_CLIENT_SECRET",
                "-e",
                "ARM_TEST_LOCATION",
                "-e",
                "ARM_TEST_LOCATION_ALT",
                "--rm",
                containerName,
                "/bin/bash",
                "-c",
                `"ssh-keygen -t rsa -b 2048 -C terraformTest -f /root/.ssh/id_rsa -N ''; rake -f ../Rakefile e2e"`,
            ],
            { shell: true },
        );
    } catch (error) {
        promptForOpenOutputChannel("Failed to run end to end tests in Docker. Please open the output channel for more details.", DialogType.error);
    }
}
