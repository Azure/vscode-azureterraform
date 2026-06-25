import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { expect } from 'chai';
import { getDocUri, open, doc } from '../helper';

suite('completion', () => {
  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test.only('schema attribute completion', async () => {
    // --- Diagnostics: extension activation ---------------------------------
    const ext = vscode.extensions.getExtension('ms-azuretools.vscode-azureterraform');
    console.log(`[diag] extension found=${!!ext} isActive(before)=${ext?.isActive}`);
    if (ext && !ext.isActive) {
      try {
        await ext.activate();
        console.log('[diag] extension activated via test');
      } catch (e) {
        console.log(`[diag] extension activate() threw: ${e}`);
      }
    }
    console.log(`[diag] isActive(after)=${ext?.isActive}`);

    // --- Diagnostics: configuration the extension actually reads -----------
    const cfg = vscode.workspace.getConfiguration('azureTerraform');
    console.log(`[diag] cfg languageServer.external=${JSON.stringify(cfg.get('languageServer.external'))}`);
    console.log(`[diag] cfg languageServer.args=${JSON.stringify(cfg.get('languageServer.args'))}`);
    console.log(`[diag] cfg languageServer.pathToBinary=${JSON.stringify(cfg.get('languageServer.pathToBinary'))}`);
    console.log(`[diag] cfg languageServer(object)=${JSON.stringify(cfg.get('languageServer'))}`);

    // --- Diagnostics: the language server binary on disk ------------------
    const binName = process.platform === 'win32' ? 'ms-terraform-lsp.exe' : 'ms-terraform-lsp';
    const binPath = ext ? path.join(ext.extensionPath, 'bin', binName) : '';
    console.log(`[diag] binPath=${binPath}`);
    try {
      const st = fs.statSync(binPath);
      console.log(`[diag] binary exists size=${st.size} mode=${(st.mode & 0o777).toString(8)}`);
    } catch (e) {
      console.log(`[diag] binary stat failed: ${e}`);
    }

    // --- Diagnostics: can the binary actually run on this runner? ----------
    try {
      const args = (cfg.get<string[]>('languageServer.args') ?? ['serve']).slice();
      const child = cp.spawn(binPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      let exitInfo = 'still-running';
      child.stdout?.on('data', (d) => (out += d.toString()));
      child.stderr?.on('data', (d) => (err += d.toString()));
      child.on('error', (e) => console.log(`[diag] spawn error: ${e}`));
      child.on('exit', (code, signal) => (exitInfo = `code=${code} signal=${signal}`));
      await new Promise((r) => setTimeout(r, 3000));
      console.log(`[diag] spawn pid=${child.pid} killed=${child.killed} exit=${exitInfo}`);
      console.log(`[diag] spawn stdout(first 300)=${JSON.stringify(out.slice(0, 300))}`);
      console.log(`[diag] spawn stderr(first 300)=${JSON.stringify(err.slice(0, 300))}`);
      child.kill();
    } catch (e) {
      console.log(`[diag] spawn threw: ${e}`);
    }

    // --- Diagnostics: force the extension to start its LSP client ----------
    // The binary runs fine when spawned directly (above), so if completions
    // still fail it means the extension never started its language client.
    // Explicitly invoke the command that starts it and observe.
    const cmds = await vscode.commands.getCommands(true);
    console.log(`[diag] has enableLanguageServer command=${cmds.includes('azureTerraform.enableLanguageServer')}`);
    try {
      await vscode.commands.executeCommand('azureTerraform.enableLanguageServer');
      console.log('[diag] enableLanguageServer command returned');
    } catch (e) {
      console.log(`[diag] enableLanguageServer threw: ${e}`);
    }
    await new Promise((r) => setTimeout(r, 3000));

    const docUri = getDocUri('properties-completion.tf');
    await open(docUri);

    // --- Diagnostics: document language registration -----------------------
    console.log(`[diag] doc.languageId=${doc.languageId} scheme=${doc.uri.scheme}`);
    if (doc.languageId !== 'terraform') {
      // The ms-terraform-lsp documentSelector only matches language "terraform".
      // Force the association in case the .tf mapping has not registered yet.
      await vscode.languages.setTextDocumentLanguage(doc, 'terraform');
      console.log(`[diag] forced languageId -> ${doc.languageId}`);
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
    let polls = 0;
    while (Date.now() < deadline) {
      const list = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        docUri,
        position,
      );
      const items = list?.items ?? [];
      const byKind: Record<string, number> = {};
      for (const i of items) {
        const k = i.kind !== undefined ? vscode.CompletionItemKind[i.kind] : 'undefined';
        byKind[k] = (byKind[k] ?? 0) + 1;
      }
      schemaItems = items.filter((i) => i.kind !== vscode.CompletionItemKind.Text);
      polls += 1;
      console.log(
        `[diag] poll #${polls}: total=${items.length} nonText=${schemaItems.length} byKind=${JSON.stringify(byKind)}`,
      );
      if (schemaItems.length > 0) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    const labels = schemaItems.map((i) =>
      typeof i.label === 'string' ? i.label : i.label.label,
    );
    console.log(`[diag] final non-Text labels: ${JSON.stringify(labels)}`);

    // `azurerm_resource_group` always exposes these attributes in its schema.
    expect(labels).to.include.members(['name', 'location', 'tags']);
  });
});