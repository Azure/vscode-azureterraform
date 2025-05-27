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
    await new Promise((r) => setTimeout(r, 1000 * 15));
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      docUri,
      new vscode.Position(22 - 1, 9 - 1),
    );

    assert.ok(list);
    expect(list).not.to.be.undefined;
    expect(list.items).not.to.be.undefined;
    // TODO: enable this when the lsp is released
    // expect(list.items.length).to.be.greaterThanOrEqual(100);
  });
});