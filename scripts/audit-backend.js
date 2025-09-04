#!/usr/bin/env node

/**
 * CodeCrucible Backend Audit Script
 * Comprehensive audit of backend functionality using MCP tools
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log(chalk.blue('🔍 CodeCrucible Backend Audit Starting...'));
console.log('====================================================');

// Audit Results
const auditResults = {
  timestamp: new Date().toISOString(),
  project: 'CodeCrucible Synth Backend',
  summary: {
    totalFiles: 0,
    passedChecks: 0,
    failedChecks: 0,
    warnings: 0,
  },
  checks: [],
};

function addCheck(name, status, details, recommendation = null) {
  const check = { name, status, details, recommendation };
  auditResults.checks.push(check);

  if (status === 'PASS') {
    auditResults.summary.passedChecks++;
    console.log(chalk.green(`✅ ${name}: ${details}`));
  } else if (status === 'FAIL') {
    auditResults.summary.failedChecks++;
    console.log(chalk.red(`❌ ${name}: ${details}`));
    if (recommendation) {
      console.log(chalk.yellow(`   💡 Recommendation: ${recommendation}`));
    }
  } else {
    auditResults.summary.warnings++;
    console.log(chalk.yellow(`⚠️  ${name}: ${details}`));
  }
}

async function auditFileStructure() {
  console.log(chalk.blue('\n📁 Auditing File Structure...'));

  const requiredFiles = [
    'src/index.ts',
    'src/core/local-model-client.ts',
    'src/core/cli.ts',
    'src/core/logger.ts',
    'src/config/config-manager.ts',
    'src/voices/voice-archetype-system.ts',
    'package.json',
    'tsconfig.json',
  ];

  for (const file of requiredFiles) {
    const fullPath = path.join(projectRoot, file);
    try {
      await fs.access(fullPath);
      addCheck(`File exists: ${file}`, 'PASS', 'Required file found');
    } catch (error) {
      addCheck(
        `File exists: ${file}`,
        'FAIL',
        'Required file missing',
        'Create the missing file or update file structure'
      );
    }
  }
}

async function auditTypeScriptConfig() {
  console.log(chalk.blue('\n🏗️  Auditing TypeScript Configuration...'));

  try {
    const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
    const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, 'utf8'));

    // Check key configuration options
    const compilerOptions = tsconfig.compilerOptions || {};

    if (compilerOptions.module === 'ESNext' || compilerOptions.module === 'ES2022') {
      addCheck('TypeScript ES Module Config', 'PASS', 'ESM module configuration detected');
    } else {
      addCheck(
        'TypeScript ES Module Config',
        'WARN',
        `Module is set to ${compilerOptions.module}`,
        'Consider using ESNext for better ES module support'
      );
    }

    if (compilerOptions.strict === true) {
      addCheck('TypeScript Strict Mode', 'PASS', 'Strict mode enabled');
    } else {
      addCheck(
        'TypeScript Strict Mode',
        'WARN',
        'Strict mode not enabled',
        'Enable strict mode for better type safety'
      );
    }

    if (
      compilerOptions.target &&
      (compilerOptions.target.includes('ES2020') || compilerOptions.target.includes('ES2022'))
    ) {
      addCheck('TypeScript Target', 'PASS', `Target set to ${compilerOptions.target}`);
    } else {
      addCheck(
        'TypeScript Target',
        'WARN',
        `Target set to ${compilerOptions.target || 'default'}`,
        'Consider using ES2020 or newer for modern features'
      );
    }
  } catch (error) {
    addCheck(
      'TypeScript Config Audit',
      'FAIL',
      'Cannot read tsconfig.json',
      'Ensure tsconfig.json exists and has valid JSON'
    );
  }
}

async function auditPackageJson() {
  console.log(chalk.blue('\n📦 Auditing Package Configuration...'));

  try {
    const packagePath = path.join(projectRoot, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));

    // Check if it's configured as ES module
    if (packageJson.type === 'module') {
      addCheck('Package ES Module Type', 'PASS', 'Package configured as ES module');
    } else {
      addCheck(
        'Package ES Module Type',
        'WARN',
        'Package not configured as ES module',
        'Add "type": "module" to package.json for ES module support'
      );
    }

    // Check essential dependencies
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    const requiredDeps = ['typescript', 'axios', 'chalk', 'commander', 'better-sqlite3'];

    for (const dep of requiredDeps) {
      if (deps[dep]) {
        addCheck(`Dependency: ${dep}`, 'PASS', `Version ${deps[dep]}`);
      } else {
        addCheck(
          `Dependency: ${dep}`,
          'FAIL',
          'Required dependency missing',
          `Install ${dep} with npm install ${dep}`
        );
      }
    }

    // Check scripts
    const scripts = packageJson.scripts || {};
    const requiredScripts = ['build', 'start', 'test'];

    for (const script of requiredScripts) {
      if (scripts[script]) {
        addCheck(`Script: ${script}`, 'PASS', `Script defined: ${scripts[script]}`);
      } else {
        addCheck(
          `Script: ${script}`,
          'WARN',
          'Script not defined',
          `Add ${script} script to package.json`
        );
      }
    }
  } catch (error) {
    addCheck(
      'Package.json Audit',
      'FAIL',
      'Cannot read package.json',
      'Ensure package.json exists and has valid JSON'
    );
  }
}

async function auditCoreModules() {
  console.log(chalk.blue('\n🧠 Auditing Core Modules...'));

  try {
    // Check LocalModelClient
    const modelClientPath = path.join(projectRoot, 'src/core/local-model-client.ts');
    const modelClientContent = await fs.readFile(modelClientPath, 'utf8');

    // Check for key methods
    const requiredMethods = [
      'checkConnection',
      'generateVoiceResponse',
      'generateMultiVoiceResponses',
      'analyzeCode',
    ];

    for (const method of requiredMethods) {
      if (
        modelClientContent.includes(`async ${method}`) ||
        modelClientContent.includes(`${method}(`)
      ) {
        addCheck(`LocalModelClient.${method}`, 'PASS', 'Method implemented');
      } else {
        addCheck(
          `LocalModelClient.${method}`,
          'FAIL',
          'Method missing',
          `Implement ${method} method in LocalModelClient`
        );
      }
    }

    // Check for Ollama integration
    if (modelClientContent.includes('11434') && modelClientContent.includes('ollama')) {
      addCheck('Ollama Integration', 'PASS', 'Ollama endpoint support detected');
    } else {
      addCheck(
        'Ollama Integration',
        'WARN',
        'Ollama integration may be incomplete',
        'Ensure Ollama endpoint (localhost:11434) is properly supported'
      );
    }

    // Check for fallback models
    if (
      modelClientContent.includes('fallbackModels') ||
      modelClientContent.includes('gpt-oss:20b')
    ) {
      addCheck('Model Fallback System', 'PASS', 'Model fallback system implemented');
    } else {
      addCheck(
        'Model Fallback System',
        'WARN',
        'No fallback system detected',
        'Implement model fallback for better reliability'
      );
    }
  } catch (error) {
    addCheck(
      'Core Modules Audit',
      'FAIL',
      'Cannot read core module files',
      'Ensure core module files exist and are readable'
    );
  }
}

async function auditImportsAndExports() {
  console.log(chalk.blue('\n🔗 Auditing ES Module Imports/Exports...'));

  const srcDir = path.join(projectRoot, 'src');

  try {
    const files = await getAllTsFiles(srcDir);
    auditResults.summary.totalFiles = files.length;

    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const relativePath = path.relative(projectRoot, file);

      // Check for proper ES module syntax
      const hasEsImports = content.includes('import ') && !content.includes('require(');
      const hasEsExports = content.includes('export ');

      if (hasEsImports || hasEsExports) {
        addCheck(`ES Modules: ${relativePath}`, 'PASS', 'Using ES module syntax');
      } else {
        addCheck(
          `ES Modules: ${relativePath}`,
          'WARN',
          'May be using CommonJS syntax',
          'Consider migrating to ES module syntax (import/export)'
        );
      }

      // Check for .js extensions in local imports
      const localImports = content.match(/import.*?from\s+['"]\.[^'"]*['"]/g) || [];
      const hasJsExtensions = localImports.some(imp => imp.includes('.js'));

      if (localImports.length > 0) {
        if (hasJsExtensions) {
          addCheck(
            `Import Extensions: ${relativePath}`,
            'PASS',
            'Using .js extensions in local imports'
          );
        } else {
          addCheck(
            `Import Extensions: ${relativePath}`,
            'WARN',
            'Missing .js extensions in some imports',
            'Add .js extensions to local imports for ES module compatibility'
          );
        }
      }
    }
  } catch (error) {
    addCheck(
      'Import/Export Audit',
      'FAIL',
      'Cannot analyze import/export patterns',
      'Check file permissions and TypeScript file structure'
    );
  }
}

async function auditDatabaseIntegration() {
  console.log(chalk.blue('\n🗄️  Auditing Database Integration...'));

  try {
    // Check for SQLite configuration
    const configFiles = ['src/config/config-manager.ts', 'src/config/database-config.ts'];

    let foundSqliteConfig = false;

    for (const configFile of configFiles) {
      const fullPath = path.join(projectRoot, configFile);
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        if (content.includes('sqlite') || content.includes('better-sqlite3')) {
          foundSqliteConfig = true;
          addCheck('SQLite Configuration', 'PASS', `Found in ${configFile}`);
        }
      } catch (error) {
        // File might not exist, which is okay
      }
    }

    if (!foundSqliteConfig) {
      addCheck(
        'SQLite Configuration',
        'WARN',
        'SQLite configuration not clearly detected',
        'Ensure SQLite is properly configured for local-only operation'
      );
    }
  } catch (error) {
    addCheck('Database Integration Audit', 'FAIL', 'Cannot analyze database configuration');
  }
}

async function auditTestConfiguration() {
  console.log(chalk.blue('\n🧪 Auditing Test Configuration...'));

  try {
    // Check Jest configuration
    const jestConfigPath = path.join(projectRoot, 'jest.config.cjs');
    const jestConfig = await fs.readFile(jestConfigPath, 'utf8');

    if (jestConfig.includes('ts-jest') && jestConfig.includes('moduleNameMapper')) {
      addCheck('Jest ES Module Config', 'PASS', 'Jest configured for ES modules with ts-jest');
    } else {
      addCheck(
        'Jest ES Module Config',
        'WARN',
        'Jest ES module configuration may be incomplete',
        'Ensure Jest is properly configured for ES modules and TypeScript'
      );
    }

    if (jestConfig.includes('__mocks__')) {
      addCheck('Jest Mocks Configuration', 'PASS', 'Mock configuration detected');
    } else {
      addCheck(
        'Jest Mocks Configuration',
        'WARN',
        'Mock configuration not detected',
        'Consider setting up mocks for external dependencies'
      );
    }

    // Check for test files
    const testDir = path.join(projectRoot, 'tests');
    try {
      const testFiles = await getAllTestFiles(testDir);
      if (testFiles.length > 0) {
        addCheck('Test Files', 'PASS', `${testFiles.length} test files found`);
      } else {
        addCheck(
          'Test Files',
          'WARN',
          'No test files found',
          'Create test files to ensure code quality'
        );
      }
    } catch (error) {
      addCheck(
        'Test Files',
        'WARN',
        'Test directory not accessible',
        'Create tests directory and add test files'
      );
    }
  } catch (error) {
    addCheck(
      'Test Configuration Audit',
      'FAIL',
      'Cannot read Jest configuration',
      'Ensure jest.config.cjs exists and is properly configured'
    );
  }
}

async function runBuildTest() {
  console.log(chalk.blue('\n🔨 Testing Build Process...'));

  try {
    execSync('npm run build', {
      cwd: projectRoot,
      stdio: 'pipe',
      timeout: 60000, // 1 minute timeout
    });
    addCheck('Build Process', 'PASS', 'TypeScript compilation successful');
  } catch (error) {
    addCheck(
      'Build Process',
      'FAIL',
      `Build failed: ${error.message}`,
      'Fix TypeScript compilation errors'
    );
  }
}

async function getAllTsFiles(dir) {
  const files = [];

  async function traverse(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }

  await traverse(dir);
  return files;
}

async function getAllTestFiles(dir) {
  const files = [];

  try {
    async function traverse(currentDir) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts'))
        ) {
          files.push(fullPath);
        }
      }
    }

    await traverse(dir);
  } catch (error) {
    // Directory might not exist
  }

  return files;
}

async function generateAuditReport() {
  console.log(chalk.blue('\n📊 Generating Audit Report...'));

  const reportPath = path.join(projectRoot, 'audit-reports', `backend-audit-${Date.now()}.json`);

  // Ensure reports directory exists
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  // Calculate overall score
  const totalChecks =
    auditResults.summary.passedChecks +
    auditResults.summary.failedChecks +
    auditResults.summary.warnings;
  const score =
    totalChecks > 0
      ? Math.round(
          ((auditResults.summary.passedChecks + auditResults.summary.warnings * 0.5) /
            totalChecks) *
            100
        )
      : 0;

  auditResults.summary.overallScore = score;
  auditResults.summary.grade =
    score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

  await fs.writeFile(reportPath, JSON.stringify(auditResults, null, 2));

  console.log(chalk.green(`\n✅ Audit report saved to: ${reportPath}`));
  return reportPath;
}

async function printSummary() {
  console.log('\n====================================================');
  console.log(chalk.bold.blue('🎯 BACKEND AUDIT SUMMARY'));
  console.log('====================================================');

  const { summary } = auditResults;

  console.log(chalk.green(`✅ Passed: ${summary.passedChecks}`));
  console.log(chalk.yellow(`⚠️  Warnings: ${summary.warnings}`));
  console.log(chalk.red(`❌ Failed: ${summary.failedChecks}`));
  console.log(chalk.blue(`📁 Files Analyzed: ${summary.totalFiles}`));

  const scoreColor =
    summary.overallScore >= 80
      ? chalk.green
      : summary.overallScore >= 60
        ? chalk.yellow
        : chalk.red;
  console.log(scoreColor(`🎯 Overall Score: ${summary.overallScore}% (Grade: ${summary.grade})`));

  if (summary.failedChecks > 0) {
    console.log(chalk.red('\n🚨 Critical Issues Found:'));
    auditResults.checks
      .filter(check => check.status === 'FAIL')
      .forEach(check => {
        console.log(chalk.red(`   • ${check.name}: ${check.details}`));
        if (check.recommendation) {
          console.log(chalk.yellow(`     → ${check.recommendation}`));
        }
      });
  }

  console.log('\n====================================================');
}

// Main audit execution
async function runBackendAudit() {
  try {
    await auditFileStructure();
    await auditTypeScriptConfig();
    await auditPackageJson();
    await auditCoreModules();
    await auditImportsAndExports();
    await auditDatabaseIntegration();
    await auditTestConfiguration();
    await runBuildTest();

    const reportPath = await generateAuditReport();
    await printSummary();

    console.log(chalk.blue(`\n📋 Detailed report available at: ${reportPath}`));

    // Exit with appropriate code
    process.exit(auditResults.summary.failedChecks > 0 ? 1 : 0);
  } catch (error) {
    console.error(chalk.red('❌ Audit failed with error:'), error);
    process.exit(1);
  }
}

// Run the audit
runBackendAudit();
