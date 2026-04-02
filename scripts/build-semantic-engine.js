const fs = require('fs');
const path = require('path');

let ts;
try {
  ts = require('typescript');
} catch (error) {
  console.error('[build-semantic-engine] Missing dependency: typescript');
  console.error(error?.message || error);
  process.exit(1);
}

const engineRoot = path.join(__dirname, '..', 'semantic-query-engine');
const transpileOptions = {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    sourceMap: false,
    declaration: false,
    importHelpers: false,
    noEmitHelpers: false,
    skipLibCheck: true,
  },
  reportDiagnostics: true,
};

function shouldSkipFile(filePath) {
  const relativePath = path.relative(engineRoot, filePath);
  if (relativePath === 'index.ts') {
    return true;
  }

  const segments = relativePath.split(path.sep);
  if (segments.includes('dist') || segments.includes('node_modules')) {
    return true;
  }

  return filePath.endsWith('.test.ts') || filePath.endsWith('.spec.ts');
}

function walk(directoryPath, visitor) {
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'node_modules') {
        continue;
      }
      walk(entryPath, visitor);
      continue;
    }

    visitor(entryPath);
  }
}

function transpileFile(sourcePath) {
  if (!sourcePath.endsWith('.ts') || shouldSkipFile(sourcePath)) {
    return;
  }

  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const result = ts.transpileModule(sourceText, {
    ...transpileOptions,
    fileName: sourcePath,
  });

  const outputPath = sourcePath.slice(0, -3) + '.js';
  fs.writeFileSync(outputPath, result.outputText, 'utf8');
  console.log(`[build-semantic-engine] ${path.relative(engineRoot, sourcePath)} -> ${path.relative(engineRoot, outputPath)}`);
}

walk(engineRoot, transpileFile);