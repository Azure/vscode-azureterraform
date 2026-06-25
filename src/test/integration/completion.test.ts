import * as vscode from 'vscode';
import { expect } from 'chai';
import { getDocUri, open, doc } from '../helper';

suite('completion', () => {
  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('schema attribute completion', async () => {
    const docUri = getDocUri('properties-completion.tf');
    await open(docUri);

    if (doc.languageId !== 'terraform') {
      await vscode.languages.setTextDocumentLanguage(doc, 'terraform');
    }

    // Attribute completion inside the `azurerm_resource_group` block.
    const position = new vscode.Position(4 - 1, 3 - 1);

    // Poll until the language server contributes schema items (it can be slow to
    // start in CI). Word-based `Text` items are ignored.
    const deadline = Date.now() + 1000 * 25;
    let schemaItems: vscode.CompletionItem[] = [];
    while (Date.now() < deadline) {
      const list = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        docUri,
        position,
      );
      const items = list?.items ?? [];
      schemaItems = items.filter((i) => i.kind !== vscode.CompletionItemKind.Text);
      if (schemaItems.length > 0) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    const labels = schemaItems.map((i) =>
      typeof i.label === 'string' ? i.label : i.label.label,
    );

    expect(labels).to.include.members(['name', 'location', 'tags']);
  });
});