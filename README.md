# Azure Terraform
[![Build Status](https://travis-ci.org/Azure/vscode-azureterraform.svg?branch=master)](https://travis-ci.org/Azure/vscode-azureterraform)
[![Release Status](https://vsmarketplacebadge.apphb.com/version-short/ms-azuretools.vscode-azureterraform.svg)](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azureterraform)

The VSCode Azure Terraform extension is designed to increase developer productivity authoring, testing and using Terraform with Azure. The extension provides terraform command support, resource graph visualization and CloudShell integration inside VSCode.

![overview](https://raw.githubusercontent.com/Azure/vscode-azureterraform/master/images/overview.png)

## Requirements

This extension requires:

- [Terraform](https://www.terraform.io/downloads.html) - If you are executing terraform commands in integrated teminal.
- [Node.js 6.0+](https://nodejs.org) - If you are using Cloud Shell.
- [GraphViz](http://www.graphviz.org) - If you are using the visualize feature.

> NOTE: Please make sure these requirements are in your PATH environment variable.

## Features

The features in this extension support execution in integrated terminal mode or remotely using Azure Cloud Shell. Some features only run locally at this time and will require some local dependencies.

This extension supports the following features:

- Terraform commands: init, plan, apply, validate, refresh and destroy.
- Visualize the terraform module.

## Commands

Open the Command Palette (`Command`+`Shift`+`P` on macOS and `Ctrl`+`Shift`+`P` on Windows/Linux) and type in one of the following commands:

<table>
  <thead>
  <tr>
    <th>Command</th>
    <th>Description</th>
  </tr>
  </thead>
  <tbody>
  <tr>
    <td width="35%">
      Basic commands:<br>
      <ul>
        <li>Azure Terraform: init</li>
        <li>Azure Terraform: plan</li>
        <li>Azure Terraform: apply</li>
        <li>Azure Terraform: validate</li>
        <li>Azure Terraform: refresh</li>
        <li>Azure Terraform: destroy</li>
      </ul>
    </td>
    <td>
      Execute terraform command against the current project workspace.
      If run with terminal set to Cloud Shell, will run the command in Cloud Shell.
    </td>
  </tr>
  <tr>
    <td>Azure Terraform: visualize</td>
    <td>Create a visual representation of the components of the module and save it in <code>graph.png</code>.</td>
  </tr>
  <tr>
    <td>Azure Terraform: push</td>
    <td>Push workspace files that meet the filter <code>azureTerraform.files</code> setting in your configuration to Cloud Shell.</td>
  </tr>
  <tr>
    <td>Azure Terraform: Execute Test</td>
    <td>
      Runs one of the following test against the current module using a test container: <br>
      <ul>
        <li>lint: This command checks the formating of the code of the Terraform module.</li>
        <li>e2e: This command will deploy the current module with the settings specified in the .tfvars file, verify that the deployment pass the controls and destroy the resources that have been created.</li>
      </ul>
    </td>
  </tr>
  </tbody>
</table>

## Extension Settings

- `azureTerraform.terminal` - Specifies terminal used to run Terraform commands. Valid settings are `cloudshell` or `integrated`.
- `azureTerraform.files` - Indicates the files that should be synchronized to Azure CloudShell using the glob pattern string. By default `**/*.{rb,sh,tf,tfvars,txt,yml}`.
- `azureTerraform.test.imageName` - Indicates the container to use to run the tests. By default: `microsoft/terraform-test`.
- `"azureTerraform.test.aciName` - Indicates the name of the Azure Container Instance to use for testing. By default: `tf-test-aci`.
- `azureTerraform.test.aciResourceGroup` - Indicates the name of the Resource Group to use for the ACI instance. By default: `tfTestResourceGroup`.
- `azureTerraform.aciContainerGroup` - Indicates the name of the Container Group that host the ACI instance. By default: `tfTestContainerGroup`
- `azureTerraform.test.location` - Indicates the location where to deploy the test container instance. By default: `westus`.

## Release Notes

Refer to [CHANGELOG](CHANGELOG.md)

## Telemetry
VS Code collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://go.microsoft.com/fwlink/?LinkID=528096&clcid=0x409) to learn more. If you would like to opt out of sending telemetry data to Microsoft, update the `telemetry.enableTelemetry` setting to `false` in the **File** -> **Preferences** -> **Settings**. Read our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting) to learn more. 

## License
[MIT](LICENSE.md)