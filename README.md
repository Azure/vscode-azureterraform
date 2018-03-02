# Azure Terraform

The VSCode Azure Terraform extension is designed to increase developer productivity building Terraform modules for Azure. The extension provides linting, terraform command support, resource graph visualization, testing and CloudShell integration inside VSCode.

![overview](images/overview.png)

## Features

The features in this extension support execution in integrated terminal mode or remotely using Azure CloudShell and Azure Container Instance. Some features only run locally at this time and will require some local dependencies.

This extension supports the following features:

- Terraform commands: init, plan, apply, validate, refresh and destroy.
- Visualize the terraform module.
- Run linting and end to end tests.

### Azure Terraform: init

Executes `terraform init` command against the current project workspace.  If run with terminal set to CloudShell, will run `terraform init` in CloudShell.

### Azure Terraform: plan

Executes `terraform plan` command against the current project workspace.  If run with terminal set to CloudShell, will run `terraform plan` in CloudShell.

### Azure Terraform: apply

Executes `terraform apply` command against the current project workspace. If run with terminal set to CloudShell, will run `terraform apply` in CloudShell.

### Azure Terraform: validate

Executes `terraform validate` command against the current project workspace. If run with terminal set to CloudShell, will run `terraform validate` in CloudShell.

### Azure Terraform: refresh

Executes `terraform refresh` command against the current project workspace. If run with terminal set to CloudShell, will run `terraform refresh` in CloudShell.

### Azure Terraform: destroy

Executes `terraform destroy` command against the current project workspace. If run with terminal set to CloudShell, will run `terraform destroy` in CloudShell.

### Azure Terraform: visualize

> NOTE: only runs locally.

Creates a visual representation of the components of the module and save it in `graph.png`. This command requires [GraphViz dot](http://www.graphviz.org) to be installed locally.

### Azure Terraform: execute test

Runs one of the following test against the current module using a test container:

- lint: This command checks the formating of the code of the Terraform module.

- end to end: This command will deploy the current module with the settings specified in the .tfvars file, verify that the deployment pass the controls and destroy the resources that have been created.

- custom: This command will run the customized command against the Terraform module.

You can run the test locally or in Azure.

- Running the test locally requires to have [Docker](http://www.docker.io) installed and create a Service Principal that will be used to authenticate against Azure.

- Running the test in Azure will create an Azure Container Group in your subscription, it will use the name and resource group defined in the settings files.

Use the following command to get the results of the test (Replace with your own values).
`az container logs -n terraformtesting -g TerraformTestRG`

In both cases the default test container is "microsoft/terraform-test" and it can be customized through the settings.

> NOTE: Running the tests in Azure will count against your Azure consumption.

### Azure Terraform: push

This command will sync workspace files that meet the filter `azureTerraform.files` setting in your configuration to Azure clouddrive.

## Requirements

This extension requires:

- [Terraform](https://www.terraform.io/downloads.html)
- [Docker](http://www.docker.io) if you are running the execute test feature locally.
- [Node.js 6.0+](https://nodejs.org) if you are using the CloudShell.
- [GraphViz dot](http://www.graphviz.org) if you are using the visualize feature.

> NOTE: On Windows after installing the graphViz msi/zip, you will most likely need to add your PATH env variable `(Ex. c:\Program Files(x86)\GraphViz2.38\bin)` in order to use dot from the command line.

## Supported Environments

- [Microsoft Azure](https://azure.microsoft.com)

## Extension Settings

- `azureTerraform` - Parent for Terraform-Azure related extension settings
- `azureTerraform.terminal` - Specifies terminal used to run Terraform commands. Valid settings are `cloudshell` or `integrated`
- `azureTerraform.files` - Indicates the files that should be synchronized to Azure CloudShell using the glob pattern string, for example `**/*.{tf,txt,yml,tfvars,rb}`
- `azureTerraform.test-container` - Indicates the container to use to run the tests, for example `microsoft/terraform-test`. Private registry is not supported at this time.
- `azureTerraform.aci-name` - Indicates the name of the Azure Container Instance to use for testing. For example: `terraformtesting`
- `azureTerraform.aci-ResGroup` - Indicates the name of the Resource Group to use for the ACI instance. For example: `TerrafornTestRG`
- `azureTerraform.aci-group` - Indicates the name of the Container Group that host the ACI instance. For example: `TerrafornTesting`
- `azureTerraform.test-location` - Indicates the location where to deploy the test container instance. For example: `westus`

## Known Issues

- Windows support for dot has some unhandled exception cases.  We are working to improve this area.
- We do not support private registry. The test container has to be on docker hub at this time.

## Release Notes

Refer to [CHANGELOG](CHANGELOG.md)
