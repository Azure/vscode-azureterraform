# Change Log

All notable changes to the "Azure Terraform" extension will be documented in this file.		
		
Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.3.0]
### Fixed
- fix some bugs and improve user experience
  - [#139](https://github.com/Azure/vscode-azureterraform/issues/139)
  - [#179](https://github.com/Azure/vscode-azureterraform/issues/179)
  - [#181](https://github.com/Azure/vscode-azureterraform/issues/181)
  - [#203](https://github.com/Azure/vscode-azureterraform/issues/203)

## [0.2.0]
### Added
- Support linting and end to end test for terraform module. ([#166](https://github.com/Azure/vscode-azureterraform/issues/166))

### Changed
- Combine push command with init, plan, apply and validate. ([#148](https://github.com/Azure/vscode-azureterraform/issues/148))

## [0.1.1]
### Changed
- Leverage Azure Account extension to provision Cloud Shell. ([#145](https://github.com/Azure/vscode-azureterraform/issues/145))

### Fixed
- Fix the Cloud Shell cannot be connected error if last session is closed because of socket timeout. ([#144](https://github.com/Azure/vscode-azureterraform/issues/144))

## [0.1.0]
### Added
- Support Terraform commands: init, plan, apply, validate, refresh and destroy.
- Support visualizing the terraform module.

