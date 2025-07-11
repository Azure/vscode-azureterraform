import * as path from 'path';
import { runTests } from '@vscode/test-electron';
import { TestOptions } from '@vscode/test-electron/out/runTest';

async function main(): Promise<void> {
  // The folder containing the Extension Manifest package.json
  // Passed to `--extensionDevelopmentPath`
  // this is also the process working dir, even if vscode opens another folder
  const extensionDevelopmentPath = path.resolve(__dirname, '../../');

  // The path to the extension test runner script
  // Passed to --extensionTestsPath
  const extensionTestsPath = path.resolve(__dirname, './integration/index');

  // common options for all runners
  const options: TestOptions = {
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: ['testFixture', '--disable-extensions', '--disable-workspace-trust'],
  };

  try {
    // Download VS Code, unzip it and run the integration test
    // start in the fixtures folder to prevent the language server from walking all the
    // project root folders, like node_modules
    await runTests(options);
  } catch (err) {
    console.error(err);
    console.error('Failed to run tests');
    process.exitCode = 1;
  }
}

main();
