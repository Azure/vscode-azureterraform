# vscode-terraform-azure README

The VSCode Terraform Azure extension is designed to increase developer productivity building Terraform modules for Azure.  The extension provides, linting, terraform command support, resource graph visualization, testing and cloudshell integration inside of VSCode.

![overview](images/image1.png)

## Features

The features in this extension support execution in integrated terminal mode or remotely using Azure CloudShell and Azure Container Instance. Some features only run locally at this time and will require some local dependencies.

This extension supports the following features:

- Terraform commands: init, plan, apply, validate, refresh, destroy
- Visualize the terraform module
- Run linting and end to end tests.

### Terraform Azure: init

Executes `terraform init` command against the current project workspace.  If run with terminal set to cloudshell, will run `terraform init` in cloudshell.
![tfinit](images/image2.png)

### Terraform Azure: plan

Executes `terraform plan` command against the current project workspace.  If run with terminal set to cloudshell, will run `terraform plan` in cloudshell.
![tfplan](images/image3.png)

### Terraform Azure: apply

Executes `terraform apply` command against the current directory. If run with terminal set to cloudshell, will run `terraform apply` in cloudshell.

### Terraform Azure: validate

Executes `terraform validate` command against the current directory. If run with terminal set to cloudshell, will run `terraform apply` in cloudshell.

### Terraform Azure: refresh

### Terraform Azure: destroy

### Terraform Azure: visualize

`NOTE: only runs locally.`

Creates a visual representation of the components of the module and save it in `graph.png`. This command requires [GraphViz dot](http://www.graphviz.org) to be installed locally.

### Terraform Azure: execute test

Runs one of the following test against the current module using a test container :

- lint: This command checks the formating of the code of the Terraform module.
- e2e no ssh: This command will deploy the current module with the settings specified in the .tfvars file, verify that the deployment pass the controls and destroy the resources that have been created.

An Azure container group will be created in your subscription, it will use the name and resource group defined in the settings files.

Use the following command to get the results of the test (Replace with your own values).
`az container logs -n terraformtesting -g TerraformTestRG`

The default test container is "microsoft/terraform-test" and it can be customized through the seetings.

### Terraform Azure: push

This command will sync workspace files that meet the filter `tf-azure.files` setting in your configuration to Azure clouddrive.

## Requirements

This extension requires:

- [Terraform](https://www.terraform.io/downloads.html)
- [Docker](http://www.docker.io) if you are running the execute test feature locally.
- [GraphViz dot](http://www.graphviz.org) if you are using the visualize feature.
  - NOTE: On Windows after installing the graphViz msi/zip, you will most likely need to add your PATH env variable `(Ex. c:\Program Files(x86)\GraphViz2.38\bin)` in order to use dot from the command line.

## Supported Environments

* [Microsoft Azure](https://azure.microsoft.com)

## Extension Settings

* `tf-azure` - Parent for Terraform-Azure related extension settings
  - `tf-azure.files` - Indicates the files that should be synchronized to Azure cloudshell using the glob pattern string, for example `**/*.{tf,txt,yml,tfvars,rb}`
  - `tf-azure.syncEnabled` - When terminal is set to `cloudshell`, indicates whether changes to files that match `tf-azure.files` setting glob pattern should automatically sync to cloudshell.`
  - `tf-azure.terminal` - Specifies terminal used to run Terraform commands. Valid settings are `cloudshell` or `integrated`
  - `tf-azure.test-container` - Indicates the container to use to run the tests, for example `microsoft/terraform-test`. Private registry is not supported at this time.
  - `tf-azure.aci-name` - Indicates the name of the Azure Container Instance to use for testing. For example: `terraformtesting`
  - `tf-azure.aci-ResGroup` - Indicates the name of the Resource Group to use for the ACI instance. For example: `TerrafornTestRG`
  - `tf-azure.aci-group` - Indicates the name of the Container Group that host the ACI instance. For example: `TerrafornTesting`
  - `tf-azure.test-location` - Indicates the location where to deploy the test container instance. For example: `westus`


## Known Issues

* Windows support for dot has some unhandled exception cases.  We are working to improve this area.
* We do not support private registry. The test container has to be on docker hub at this time.

## Release Notes

### 1.0.0

Initial release of vscode-terraform-azure extension.

-----------------------------------------------------------------------------------------------------------

## Working with Markdown

**Note:** You can author your README using Visual Studio Code.  Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on OSX or `Ctrl+\` on Windows and Linux)
* Toggle preview (`Shift+CMD+V` on OSX or `Shift+Ctrl+V` on Windows and Linux)
* Press `Ctrl+Space` (Windows, Linux) or `Cmd+Space` (OSX) to see a list of Markdown snippets

### For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**