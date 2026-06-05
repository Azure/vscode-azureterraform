# Change Log

All notable changes to the "Microsoft Terraform" extension will be
documented in this file.

Check [Keep a Changelog](https://keepachangelog.com/) for recommendations on
how to structure this file.

## [0.10.2]

### Changed for 0.10.2

- Updated package dependencies:
  - `@typescript-eslint/eslint-plugin`: `^8.60.0` → `^8.60.1`
  - `@typescript-eslint/parser`: `^8.60.0` → `^8.60.1`
  - `axios`: `^1.16.1` → `^1.17.0`
  - `typescript-eslint`: `^8.60.0` → `^8.60.1`

## [0.10.1]

### Changed for 0.10.1

- Updated package dependencies:
  - `eslint`: `^10.4.0` → `^10.4.1`
  - `eslint-plugin-prettier`: `^5.5.5` → `^5.5.6`

## [0.10.0]

### Changed for 0.10.0

- Changed `azureTerraform.aztfpreflight.pathToBinary` from `resource` to `machine` scope.
- Updated package dependencies:
  - `@azure/identity`: `^4.9.1` → `^4.13.1`
  - `@azure/storage-file-share`: `^12.28.0` → `^12.30.0`
  - `@microsoft/vscode-azext-azureauth`: `^4.1.1` → `^4.2.2`
  - `@typescript-eslint/eslint-plugin`: `^8.56.1` → `^8.60.0`
  - `@typescript-eslint/parser`: `^8.56.1` → `^8.60.0`
  - `@vscode/extension-telemetry`: `^1.0.0` → `^1.5.2`
  - `axios`: `^1.13.5` → `^1.16.1`
  - `esbuild`: `^0.25.2` → `^0.28.0`
  - `eslint`: `^10.0.2` → `^10.4.0`
  - `lodash`: `^4.17.23` → `^4.18.1`
  - `mocha`: `^11.0.1` → `^11.7.6`
  - `opn`: `5.1.0` → `5.5.0`
  - `prettier`: `^3.8.1` → `^3.8.3`
  - `typescript-eslint`: `^8.56.1` → `^8.60.0`
  - `vscode-extension-telemetry-wrapper`: `^0.8.0` → `^0.15.3`

## [0.9.0]

### Changed for 0.9.0

- Updated ms-terraform-lsp to v0.9.0
- Migrated to ESLint v9 flat config. ([#304](https://github.com/Azure/vscode-azureterraform/pull/304))
- Refreshed several dependencies, including `axios`, `lodash`, `fast-xml-parser`, `flatted`, `js-yaml`, `jws`, and `minimatch`.

### Fixed for 0.9.0

- Skipped `.zip` files when locating the extracted `aztfpreflight` binary on Linux and macOS, preventing the downloader from renaming the archive by mistake. ([#309](https://github.com/Azure/vscode-azureterraform/pull/309))

## [0.8.0]

### Added for 0.8.0

- Update ms-terraform-lsp to v0.8.0
- Update survey link.

## [0.7.0]

### Added for 0.7.0

- Support for Terraform preflight validation command. Preflight validation
  runs against generated Terraform plans to identify potential issues before
  deployment
- Integrated `aztfpreflight` binary download and execution

## [0.6.0]

### Added for 0.6.0

- Support auto-completion and hover documentation for Azure Verified Modules.
- Add auto-completion and hover documentation for data sources.

## [0.5.0]

### Added for 0.5.0

- Suggest azapi provider resources, properties, and values for those
  properties
- On-hover documentation for azapi resources and properties
- Code actions to migrate resources between azurerm and azapi providers
- Copy ARM Template/Resource JSON and paste it as azapi configuration

## [0.4.0]

### Added for 0.4.0

- Suggest azurerm provider resources, properties, and values for those
  properties
- On-hover documentation for fields
- Suggestion and on-hover features for msgraph provider
- Integration with Azure Export for Terraform to export Azure resources as
  Terraform blocks
- Integrated survey for user feedback
- Support for code actions to generate required/missing permissions for
  `azurerm` providers

### Fixed for 0.4.0

- General improvements and bug fixes

## [0.3.3]

### Changed for 0.3.3

- Removed Azure Account extension dependency
  - [#254](https://github.com/Azure/vscode-azureterraform/pull/254)
- CloudShell functionality is temporarily unavailable
- Default terminal setting now falls back to integrated terminal when
  CloudShell is selected

## [0.3.2]

### Fixed for 0.3.2

- fix dependency issues
  - [#212](https://github.com/Azure/vscode-azureterraform/issues/212)
  - [#222](https://github.com/Azure/vscode-azureterraform/issues/222)

## [0.3.1]

### Fixed for 0.3.1

- fix some security issues
  - [#220](https://github.com/Azure/vscode-azureterraform/pull/220)

## [0.3.0]

### Fixed for 0.3.0

- fix some bugs and improve user experience
  - [#139](https://github.com/Azure/vscode-azureterraform/issues/139)
  - [#179](https://github.com/Azure/vscode-azureterraform/issues/179)
  - [#181](https://github.com/Azure/vscode-azureterraform/issues/181)
  - [#203](https://github.com/Azure/vscode-azureterraform/issues/203)

## [0.2.0]

### Added for 0.2.0

- Support linting and end to end test for terraform module.
  ([#166](https://github.com/Azure/vscode-azureterraform/issues/166))

### Changed for 0.2.0

- Combine push command with init, plan, apply and validate.
  ([#148](https://github.com/Azure/vscode-azureterraform/issues/148))

## [0.1.1]

### Changed for 0.1.1

- Leverage Azure Account extension to provision Cloud Shell.
  ([#145](https://github.com/Azure/vscode-azureterraform/issues/145))

### Fixed for 0.1.1

- Fix the Cloud Shell cannot be connected error if last session is closed
  because of socket timeout.
  ([#144](https://github.com/Azure/vscode-azureterraform/issues/144))

## [0.1.0]

### Added for 0.1.0

- Support Terraform commands: init, plan, apply, validate, refresh and
  destroy.
- Support visualizing the terraform module.
