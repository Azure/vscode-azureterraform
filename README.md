# Microsoft Terraform

The VSCode Microsoft Terraform extension is designed to increase developer productivity authoring, testing and using Terraform with Azure. The extension provides terraform command support and resource graph visualization.

![overview](https://raw.githubusercontent.com/Azure/vscode-azureterraform/master/images/overview.png)

## Important Note
⚠️ **CloudShell integration is currently unavailable** in this version of the extension. All Terraform commands will run in your local integrated terminal.

## Requirements

This extension requires:

- [Terraform](https://www.terraform.io/downloads.html) - Required for executing terraform commands
- [GraphViz](http://www.graphviz.org) - Required for the visualize feature

> NOTE: Please make sure these requirements are in your PATH environment variable.

## Features

This extension supports the following features:

- Terraform commands: init, plan, apply, validate, refresh and destroy
- Visualize the terraform module
- Suggest resources, properties, and values for those properties

![demo](https://raw.githubusercontent.com/Azure/vscode-azureterraform/master/images/autocomplete.gif)

- On-hover documentation

![demo](https://raw.githubusercontent.com/Azure/vscode-azureterraform/master/images/autocomplete.gif)

- Ingtegration with [Azure Export for Terraform](https://learn.microsoft.com/en-us/azure/developer/terraform/azure-export-for-terraform/export-terraform-overview) to Export Azure Resources As Terraform Blocks

![demo](https://raw.githubusercontent.com/Azure/vscode-azureterraform/master/images/autocomplete.gif)

- Integrated survey for user feedback

![demo](https://raw.githubusercontent.com/Azure/vscode-azureterraform/master/images/autocomplete.gif)

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
        <li>Microsoft Terraform: init</li>
        <li>Microsoft Terraform: plan</li>
        <li>Microsoft Terraform: apply</li>
        <li>Microsoft Terraform: validate</li>
        <li>Microsoft Terraform: refresh</li>
        <li>Microsoft Terraform: destroy</li>
      </ul>
    </td>
    <td>
      Execute terraform command against the current project workspace.
      <br><br>
      <em>Note: All commands run in your local integrated terminal.</em>
    </td>
  </tr>
  <tr>
    <td>Microsoft Terraform: visualize</td>
    <td>Create a visual representation of the components of the module and save it in <code>graph.png</code>.</td>
  </tr>
  <tr>
    <td>Microsoft Terraform: Execute Test</td>
    <td>
      Run one of the following test against the current module using a test container: <br>
      <ul>
        <li>lint: This command will check the formating of the code of the Terraform module.</li>
        <li>e2e: This command will deploy the current module with the settings specified in the .tfvars file, verify that the deployment pass the controls and destroy the resources that have been created.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>Microsoft Terraform: Export Azure Resource as Terraform</td>
    <td>Export existing Azure resources as Terraform configuration blocks using Azure Export for Terraform. This helps you migrate existing Azure resources to Terraform-managed infrastructure.</td>
  </tr>
  <tr>
    <td>Microsoft Terraform: Show Survey</td>
    <td>Open the feedback survey to share your experience and help us improve.</td>
  </tr>
  </tbody>
</table>

## Extension Settings

- `azureTerraform.terminal` - Specifies terminal used to run Terraform commands. Currently only `integrated` terminal is supported.
- `azureTerraform.test.imageName` - Indicates the container to use to run the tests. By default: `microsoft/terraform-test`.
- `azureTerraform.test.aciName` - Indicates the name of the Azure Container Instance to use for testing. By default: `tf-test-aci`.
- `azureTerraform.test.aciResourceGroup` - Indicates the name of the Resource Group to use for the ACI instance. By default: `tfTestResourceGroup`.
- `azureTerraform.aciContainerGroup` - Indicates the name of the Container Group that host the ACI instance. By default: `tfTestContainerGroup`
- `azureTerraform.test.location` - Indicates the location where to deploy the test container instance. By default: `westus`.

## Release Notes

Refer to [CHANGELOG](CHANGELOG.md)

## Telemetry
VS Code collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://go.microsoft.com/fwlink/?LinkID=528096&clcid=0x409) to learn more. If you would like to opt out of sending telemetry data to Microsoft, update the `telemetry.enableTelemetry` setting to `false` in the **File** -> **Preferences** -> **Settings**. Read our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting) to learn more.

## License
[MIT](LICENSE.md)
