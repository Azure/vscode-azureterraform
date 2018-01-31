"use strict";

export class Constants {
    public static ExtensionId = "vscode-terraform-azure";
    public static LineSeperator = Array(50).join("=");
    public static AzureAccountExtensionId = "ms-vscode.azure-account";
    public static TerraformTerminalName = "Terraform";
    public static UserAgentName = "VSCODEEXT_USER_AGENT";
    public static TestContainer = "microsoft/terraform-test";
    public static clouddrive = "~/clouddrive";
}

export function aciConfig(resourceGroup: string, aciName: string, aciGroup: string, storageAccountName: string, storageAccountShare: string, location: string, testContainer: string, projectName: string): string {
    let TFConfiguration: string;
    // TODO - add a check on the location where ACI is available - if (['westus', eastus].indexOf(location) == -1) {

    TFConfiguration = `variable "location" {
        default = "${location}"
    }

variable "storage_account_key" { }

resource "azurerm_resource_group" "TFTest" {
    name     = "${resourceGroup}"
    location = "${location}"
}
resource "azurerm_container_group" "TFTest" {
    depends_on = ["azurerm_resource_group.TFTest"]
    name = "${aciGroup}"
    location = "${location}"
    resource_group_name = "${resourceGroup}"
    ip_address_type = "public"
    os_type     = "linux"

    container {
        name = "${aciName}"
        image = "${testContainer}"
        cpu = "1"
        memory = "2"
        port = "80"

        environment_variables {
            "ARM_TEST_LOCATION"="${location}"
            "ARM_TEST_LOCATION_ALT"="${location}"
        }

        command = "/bin/bash -c '/module/${projectName}/.TFTesting/containercmd.sh'"

        volume {
            name = "module"
            mount_path = "/module"
            read_only = false
            share_name = "${storageAccountShare}"
            storage_account_name = "${storageAccountName}"
            storage_account_key = "\${var.storage_account_key}"
        }

        volume {
            name = "logs"
            mount_path = "/tf-test/module/.kitchen"
            read_only = false
            share_name = "kitchen-logs"
            storage_account_name = "${storageAccountName}"
            storage_account_key = "\${var.storage_account_key}"
        }
    }
}`;

    return TFConfiguration;
}

export function exportTestScript(testType: string, TFConfiguration: string, resoureGroupName: string, storageAccountName: string, fileShareName: string, testDirectory: string): string {
    const testScript = `
        #!/bin/bash
        if [ ! -d "$HOME/clouddrive/${testDirectory}" ]; then
            mkdir -p $HOME/clouddrive/${testDirectory}
        fi

        if [ ! -d "$HOME/clouddrive/${testDirectory}/.ssh" ]; then
            mkdir -p $HOME/clouddrive/${testDirectory}
        fi

        echo -e "${TFConfiguration}" > $HOME/clouddrive/${testDirectory}/testfile.tf

        export TF_VAR_storage_account_key=$(az storage account keys list -g ${resoureGroupName} -n ${storageAccountName} | jq '.[0].value')

        if [ -f "$HOME/clouddrive/${testDirectory}/.ssh/id_rsa" ]; then
            mv $HOME/clouddrive/${testDirectory}/.ssh/id_rsa $HOME/clouddrive/${testDirectory}/.ssh/id_rsa.old
        fi

        if [ -f "$HOME/clouddrive/${testDirectory}/.ssh/id_rsa.pub" ]; then
            mv $HOME/clouddrive/${testDirectory}/.ssh/id_rsa.pub $HOME/clouddrive/${testDirectory}/.ssh/id_rsa.pub.old
        fi

        ssh-keygen -t rsa -b 2048 -C "vscode-testing" -f $HOME/clouddrive/${testDirectory}/.ssh/id_rsa -N ""

        cp -r $HOME/.azure/ $HOME/clouddrive/${testDirectory}/

    `;

    return testScript;
}

export function exportContainerCmd(moduleDir: string, containerCommand: string): string {
    const containerScript = `
        #!/bin/bash

        mkdir /root/.ssh
        cp -r /module/${moduleDir}/ /tf-test/module/

        mkdir /root/.azure
        cp /module/${moduleDir}/.TFTesting/.azure/*.json /root/.azure

        cp /tf-test/module/${moduleDir}/.TFTesting/.ssh/* /root/.ssh/

        cd ${moduleDir}
        ${containerCommand}
        echo "Container test operation completed - read the logs for status"
    `;

    return containerScript;

}
