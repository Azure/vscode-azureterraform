import * as vscode from 'vscode';
import * as assert from 'assert';
import { expect } from 'chai';
import { getDocUri, open } from '../helper';

suite('completion', () => {
  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('templates completion', async () => {
    const docUri = getDocUri('templates-completion.tf');
    await open(docUri);

    // The language server needs time to start up and index its schemas before
    // it can return the full completion list. The startup time varies by
    // machine (notably slower in CI), so poll until the server returns enough
    // items instead of relying on a single fixed delay.
    const position = new vscode.Position(22 - 1, 9 - 1);
    const deadline = Date.now() + 1000 * 60;
    let list: vscode.CompletionList | undefined;
    while (Date.now() < deadline) {
      list = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        docUri,
        position,
      );
      if (list && list.items && list.items.length >= 100) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    assert.ok(list);
    expect(list).not.to.be.undefined;
    expect(list!.items).not.to.be.undefined;
    expect(list!.items.length).to.be.greaterThanOrEqual(100);
  });
});