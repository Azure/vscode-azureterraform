import { azFilePush } from "./shared";

export class Constants {
    public static ExtensionId = "vscode-terraform-azure";
    public static LineSeperator = Array(50).join("=");
    public static AzureAccountExtensionId = "ms-vscode.azure-account";
    public static TerraformTerminalName = "Terraform";
    public static UserAgentName = "VSCODEEXT_USER_AGENT";
    public static TestContainer = "microsoft/terraform-test";
    public static clouddrive = "~/clouddrive";
}

export function aciConfig(resourceGroup: string, storageAccountName: string, storageAccountShare: string, location: string, testContainer: string, testCommand: string): string {
    let TFConfiguration: string;
    // TODO - add a check on the location where ACI is available - if (['westus', eastus].indexOf(location) == -1) {
    if ( location == null) {
        location = "westus";
    }

    TFConfiguration = `variable "location" {
        default = "${location}"
    }

variable "storage_account_key" { }

resource "azurerm_resource_group" "TFTest" {
    name     = "${resourceGroup}"
    location = "${location}"
}
resource "azurerm_container_group" "TFTest" {
    name = "TerraformTesting"
    location = "${location}"
    resource_group_name = "${resourceGroup}"
    ip_address_type = "public"
    os_type     = "linux"

    container {
        name = "terraformtesting"
        image = "${testContainer}"
        cpu = "1"
        memory = "2"
        port = "80"

        command = "${testCommand}"

        volume {
            name = "module"
            mount_path = "/tf-test/module"
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
        #/bin/bash
        if [ ! -d "${testDirectory}" ]; then
            mkdir -p $HOME/clouddrive/${testDirectory}
        fi

        echo -e "${TFConfiguration}" > $HOME/clouddrive/${testDirectory}/testfile.tf

        export TF_VAR_storage_account_key=$(az storage account keys list -g ${resoureGroupName} -n ${storageAccountName} | jq '.[0].value')

    `;

    return testScript;
}
