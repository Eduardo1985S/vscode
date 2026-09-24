/*---------------------------------------------------------------------------------------------
 * JS Studio Scratchpad
 * Local JavaScript/TypeScript scratchpad with no AI or external services.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');

let scratchpadPanel;

function activate(context) {
	context.subscriptions.push(
		vscode.commands.registerCommand('scratchpad.open', () => openScratchpad(context, false)),
		vscode.commands.registerCommand('scratchpad.new', () => openScratchpad(context, true))
	);
}

function deactivate() {
	if (scratchpadPanel) {
		scratchpadPanel.dispose();
		scratchpadPanel = undefined;
	}
}

function openScratchpad(context, createNewTab) {
	if (scratchpadPanel) {
		scratchpadPanel.reveal(vscode.ViewColumn.One);
		if (createNewTab) {
			scratchpadPanel.webview.postMessage({ type: 'createTab' });
		}
		return;
	}

	const mediaUri = vscode.Uri.joinPath(context.extensionUri, 'media');
	scratchpadPanel = vscode.window.createWebviewPanel(
		'jsStudioScratchpad',
		'JS Studio • Scratchpad',
		vscode.ViewColumn.One,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [mediaUri]
		}
	);

	scratchpadPanel.iconPath = vscode.Uri.joinPath(mediaUri, 'logo.png');
	scratchpadPanel.webview.html = getWebviewHtml(scratchpadPanel.webview, mediaUri);

	let shouldCreateNewTab = createNewTab;

	const messageSubscription = scratchpadPanel.webview.onDidReceiveMessage(async message => {
		switch (message.type) {
			case 'ready': {
				const tabs = context.workspaceState.get('jsStudio.scratchpad.tabs');
				await scratchpadPanel.webview.postMessage({
					type: 'init',
					tabs: Array.isArray(tabs) ? tabs : null,
					packages: getWorkspacePackages(),
					nodeVersion: process.versions.node
				});
				if (shouldCreateNewTab) {
					shouldCreateNewTab = false;
					await scratchpadPanel.webview.postMessage({ type: 'createTab' });
				}
				break;
			}
			case 'saveTabs':
				await context.workspaceState.update('jsStudio.scratchpad.tabs', message.tabs);
				break;
			case 'getPackages':
				await scratchpadPanel.webview.postMessage({
					type: 'packagesList',
					packages: getWorkspacePackages()
				});
				break;
			case 'execute': {
				const result = await executeCode(message.code || '', message.mode || 'javascript');
				await scratchpadPanel.webview.postMessage({
					type: 'results',
					tabId: message.tabId,
					...result
				});
				break;
			}
		}
	});

	scratchpadPanel.onDidDispose(() => {
		messageSubscription.dispose();
		scratchpadPanel = undefined;
	});
}

function getWebviewHtml(webview, mediaUri) {
	const htmlPath = vscode.Uri.joinPath(mediaUri, 'scratchpad.html').fsPath;
	let html = fs.readFileSync(htmlPath, 'utf8');

	const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'scratchpad.css'));
	const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'scratchpad.js'));
	const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'logo.png'));

	return html
		.replace(/{{CSS_URI}}/g, String(cssUri))
		.replace(/{{JS_URI}}/g, String(jsUri))
		.replace(/{{LOGO_URI}}/g, String(logoUri))
		.replace(/{{CSP_SOURCE}}/g, webview.cspSource);
}

function getWorkspaceRoot() {
	return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
}

function getWorkspacePackages() {
	const packagePath = path.join(getWorkspaceRoot(), 'package.json');
	try {
		const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
		return [...new Set([
			...Object.keys(pkg.dependencies || {}),
			...Object.keys(pkg.devDependencies || {})
		])].sort((a, b) => a.localeCompare(b));
	} catch {
		return [];
	}
}

async function executeCode(source, mode) {
	const startedAt = Date.now();
	const logs = [];
	const outputs = [];

	if (!vscode.workspace.isTrusted) {
		return {
			outputs,
			logs,
			timeMs: Date.now() - startedAt,
			error: { message: 'Confie na pasta de trabalho para executar código no Scratchpad.' }
		};
	}

	try {
		let code = source;

		if (mode === 'typescript') {
			const ts = require('typescript');
			const transpiled = ts.transpileModule(code, {
				compilerOptions: {
					target: ts.ScriptTarget.ES2022,
					module: ts.ModuleKind.CommonJS,
					esModuleInterop: true,
					jsx: ts.JsxEmit.ReactJSX
				},
				reportDiagnostics: true
			});

			const fatalDiagnostic = transpiled.diagnostics?.find(d => d.category === ts.DiagnosticCategory.Error);
			if (fatalDiagnostic) {
				const message = ts.flattenDiagnosticMessageText(fatalDiagnostic.messageText, '\n');
				const line = fatalDiagnostic.file && typeof fatalDiagnostic.start === 'number'
					? fatalDiagnostic.file.getLineAndCharacterOfPosition(fatalDiagnostic.start).line + 1
					: undefined;
				return {
					outputs,
					logs,
					timeMs: Date.now() - startedAt,
					error: { message, line }
				};
			}
			code = transpiled.outputText;
		}

		const root = getWorkspaceRoot();
		const workspaceRequire = createRequire(path.join(root, 'package.json'));
		const consoleProxy = createConsoleProxy(logs);

		const sandbox = {
			console: consoleProxy,
			require: workspaceRequire,
			module: { exports: {} },
			exports: {},
			__dirname: root,
			__filename: path.join(root, mode === 'typescript' ? 'scratchpad.ts' : 'scratchpad.js'),
			process,
			Buffer,
			setTimeout,
			clearTimeout,
			setInterval,
			clearInterval,
			setImmediate,
			clearImmediate,
			URL,
			URLSearchParams,
			fetch: globalThis.fetch
		};

		const context = vm.createContext(sandbox);
		let value;

		try {
			const script = new vm.Script(code, { filename: 'js-studio-scratchpad.js' });
			value = script.runInContext(context, { timeout: 2000 });
		} catch (error) {
			if (error instanceof SyntaxError && /await is only valid|Unexpected reserved word/i.test(error.message)) {
				const script = new vm.Script(`(async () => {\n${code}\n})()`, { filename: 'js-studio-scratchpad.js' });
				value = script.runInContext(context, { timeout: 2000 });
			} else {
				throw error;
			}
		}

		if (value && typeof value.then === 'function') {
			value = await Promise.race([
				value,
				new Promise((_, reject) => setTimeout(() => reject(new Error('Execução excedeu 5 segundos.')), 5000))
			]);
		}

		if (value !== undefined) {
			outputs.push({
				line: lastMeaningfulLine(source),
				display: formatValue(value),
				type: valueType(value)
			});
		}

		return {
			outputs,
			logs,
			timeMs: Date.now() - startedAt,
			error: null
		};
	} catch (error) {
		return {
			outputs,
			logs,
			timeMs: Date.now() - startedAt,
			error: {
				message: error && error.message ? error.message : String(error),
				line: extractLine(error)
			}
		};
	}
}

function createConsoleProxy(logs) {
	const add = level => (...args) => {
		logs.push({
			level,
			text: args.map(formatValue).join(' ')
		});
	};

	return {
		log: add('log'),
		info: add('info'),
		warn: add('warn'),
		error: add('error'),
		table: add('log')
	};
}

function formatValue(value) {
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'bigint') {
		return `${value}n`;
	}
	if (typeof value === 'function') {
		return `[Function ${value.name || 'anonymous'}]`;
	}
	if (value === undefined) {
		return 'undefined';
	}
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function valueType(value) {
	if (Array.isArray(value)) {
		return 'array';
	}
	if (value === null) {
		return 'null';
	}
	return typeof value;
}

function lastMeaningfulLine(source) {
	const lines = String(source).split(/\r?\n/);
	for (let index = lines.length - 1; index >= 0; index--) {
		if (lines[index].trim()) {
			return index + 1;
		}
	}
	return 1;
}

function extractLine(error) {
	const stack = error && error.stack ? String(error.stack) : '';
	const match = stack.match(/js-studio-scratchpad\.js:(\d+):(\d+)/);
	return match ? Number(match[1]) : undefined;
}

module.exports = { activate, deactivate };
