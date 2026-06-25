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

    // The ms-terraform-lsp documentSelector only matches language "terraform",
    // so make sure the opened document is associated with it.
    if (doc.languageId !== 'terraform') {
      await vscode.languages.setTextDocumentLanguage(doc, 'terraform');
    }

    // Request attribute completion on the empty line inside the
    // `azurerm_resource_group` block. These suggestions come from the provider
    // schema bundled with the language server, so they are deterministic and do
    // not depend on the Terraform Registry (unlike template/module snippets).
    const position = new vscode.Position(4 - 1, 3 - 1);

    // The language server needs time to start up and load its schemas. Startup
    // time varies by machine (notably slower in CI), so poll until the server
    // contributes schema-based items instead of relying on a single fixed delay.
    // VS Code also returns word-based (`Text`) completions from the buffer, so
    // those are filtered out when deciding whether the server has responded.
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

    // `azurerm_resource_group` always exposes these attributes in its schema.
    expect(labels).to.include.members(['name', 'location', 'tags']);
  });
});