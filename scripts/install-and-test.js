#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const chalk = require('chalk');

console.log(chalk.blue('🚀 CodeCrucible Synth Installation & Testing'));
console.log(chalk.gray('====================================================\n'));

async function runCommand(command, args, description) {
  console.log(chalk.yellow(`⚡ ${description}...`));
  
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { 
      stdio: 'inherit',
      shell: true 
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`✅ ${description} completed\n`));
        resolve();
      } else {
        console.log(chalk.red(`❌ ${description} failed with code ${code}\n`));
        reject(new Error(`Command failed: ${command} ${args.join(' ')}`));
      }
    });
    
    child.on('error', (error) => {
      console.log(chalk.red(`❌ ${description} failed: ${error.message}\n`));
      reject(error);
    });
  });
}

async function checkPrerequisites() {
  console.log(chalk.blue('🔍 Checking Prerequisites'));
  console.log(chalk.gray('-------------------------\n'));
  
  try {
    // Check Node.js version
    const nodeVersion = process.version;
    console.log(chalk.green(`✅ Node.js: ${nodeVersion}`));
    
    // Check npm
    await runCommand('npm', ['--version'], 'Checking npm');
    
    // Check if Ollama is available
    try {
      await runCommand('ollama', ['--version'], 'Checking Ollama');
    } catch (error) {
      console.log(chalk.yellow('⚠️  Ollama not found. Install from https://ollama.ai'));
      console.log(chalk.gray('   You can continue without Ollama, but local AI won\'t work\n'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Prerequisites check failed:'), error.message);
    throw error;
  }
}

async function buildProject() {
  console.log(chalk.blue('🔨 Building Project'));
  console.log(chalk.gray('-------------------\n'));
  
  try {
    await runCommand('npm', ['install'], 'Installing dependencies');
    await runCommand('npm', ['run', 'build'], 'Building project');
    
    // Verify build output
    if (await fs.pathExists('dist/index.js')) {
      console.log(chalk.green('✅ Build output verified\n'));
    } else {
      throw new Error('Build output not found');
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Build failed:'), error.message);
    throw error;
  }
}

async function testBasicFunctionality() {
  console.log(chalk.blue('🧪 Testing Basic Functionality'));
  console.log(chalk.gray('------------------------------\n'));
  
  try {
    // Test help command
    await runCommand('node', ['dist/index.js', '--help'], 'Testing help command');
    
    // Test configuration
    await runCommand('node', ['dist/index.js', 'config', '--list'], 'Testing configuration');
    
    // Test voices list
    await runCommand('node', ['dist/index.js', 'voices', '--list'], 'Testing voices list');
    
    console.log(chalk.green('✅ Basic functionality tests passed\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Tests failed:'), error.message);
    throw error;
  }
}

async function testModelConnection() {
  console.log(chalk.blue('🤖 Testing AI Model Connection'));
  console.log(chalk.gray('------------------------------\n'));
  
  try {
    await runCommand('node', ['dist/index.js', 'model', '--status'], 'Testing model connection');
    console.log(chalk.green('✅ Model connection test completed\n'));
    
  } catch (error) {
    console.log(chalk.yellow('⚠️  Model connection test failed - this is expected if Ollama is not set up'));
    console.log(chalk.gray('   To set up local AI:'));
    console.log(chalk.gray('   1. Install Ollama: https://ollama.ai'));
    console.log(chalk.gray('   2. Run: ollama pull gpt-oss:20b'));
    console.log(chalk.gray('   3. Start: ollama serve\n'));
  }
}

async function showSuccessMessage() {
  console.log(chalk.green('🎉 Installation & Testing Complete!'));
  console.log(chalk.gray('===================================\n'));
  
  console.log(chalk.cyan('📋 Next Steps:'));
  console.log(chalk.gray('1. Set up Ollama and gpt-oss:20b model (if not done)'));
  console.log(chalk.gray('2. Link globally: npm link'));
  console.log(chalk.gray('3. Test with: cc --help'));
  console.log(chalk.gray('4. Try: cc "Create a hello world function"\n'));
  
  console.log(chalk.cyan('🔗 Quick Commands:'));
  console.log(chalk.gray('• Interactive mode: cc -i'));
  console.log(chalk.gray('• Voice consultation: cc voice explorer "your question"'));
  console.log(chalk.gray('• File analysis: cc file analyze path/to/file.js'));
  console.log(chalk.gray('• Agentic mode: cc agent --watch'));
  console.log(chalk.gray('• Desktop GUI: cc desktop'));
  console.log(chalk.gray('• Server mode: cc serve\n'));
  
  console.log(chalk.green('🚀 Happy coding with CodeCrucible Synth!'));
}

async function main() {
  try {
    await checkPrerequisites();
    await buildProject();
    await testBasicFunctionality();
    await testModelConnection();
    await showSuccessMessage();
    
  } catch (error) {
    console.error(chalk.red('\n💥 Installation failed:'), error.message);
    console.log(chalk.yellow('\n🛠️  Troubleshooting:'));
    console.log(chalk.gray('• Ensure Node.js 18+ is installed'));
    console.log(chalk.gray('• Run npm install to resolve dependencies'));
    console.log(chalk.gray('• Check file permissions'));
    console.log(chalk.gray('• Try running with sudo (Linux/macOS) if needed\n'));
    process.exit(1);
  }
}

// Handle interruptions gracefully
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n⚠️  Installation interrupted by user'));
  process.exit(1);
});

main();