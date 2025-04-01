# Change Log

All notable changes to the "Azure Terraform" extension will be documented in this file.		
		
Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.3.3]
### Changed
- Removed Azure Account extension dependency
  - [#254](https://github.com/Azure/vscode-azureterraform/pull/254)
- CloudShell functionality is temporarily unavailable
- Default terminal setting now falls back to integrated terminal when CloudShell is selected

## [0.3.2]
### Fixed
- fix dependency issues
  - [#212](https://github.com/Azure/vscode-azureterraform/issues/212)
  - [#222](https://github.com/Azure/vscode-azureterraform/issues/222)

## [0.3.1]
### Fixed
- fix some security issues
  - [#220](https://github.com/Azure/vscode-azureterraform/pull/220)

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
