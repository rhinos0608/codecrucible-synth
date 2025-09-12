import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BuildProjectSchema = z.object({
  buildTool: z
    .enum(['npm', 'yarn', 'webpack', 'vite', 'rollup', 'tsc', 'esbuild'])
    .default('npm')
    .describe('Build tool to use'),
  buildScript: z.string().optional().describe('Specific build script to run (overrides default)'),
  environment: z
    .enum(['development', 'production', 'test'])
    .default('production')
    .describe('Build environment'),
  watch: z.boolean().default(false).describe('Whether to run build in watch mode'),
  optimize: z.boolean().default(true).describe('Whether to optimize the build'),
  sourceMaps: z.boolean().default(false).describe('Whether to generate source maps'),
  timeout: z.number().default(300000).describe('Build timeout in milliseconds'),
});

export interface PackageJson {
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

export class BuildAutomatorTool extends BaseTool<typeof BuildProjectSchema.shape> {
  public constructor(private readonly agentContext: Readonly<{ workingDirectory: string }>) {
    super({
      name: 'buildProject',
      description: 'Builds the project using various build tools and configurations',
      category: 'Build Automation',
      parameters: BuildProjectSchema,
    });
  }

  public async execute(args: Readonly<z.infer<typeof BuildProjectSchema>>): Promise<string> {
    try {
      const { buildTool, buildScript, environment, watch, optimize, sourceMaps, timeout } = args;

      // Check if package.json exists to understand the project structure
      const packageJsonPath = join(this.agentContext.workingDirectory, 'package.json');
      let packageJson: PackageJson = {};

      try {
        const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
        packageJson = JSON.parse(packageContent) as PackageJson;
      } catch {
        // No package.json found, will use basic commands
      }

      const command = this.buildCommand(
        buildTool,
        buildScript,
        packageJson,
        environment,
        watch,
        optimize,
        sourceMaps
      );

      console.log(`Building project with command: ${command}`);

      const startTime = Date.now();

      const { stdout, stderr } = await execAsync(command, {
        cwd: this.agentContext.workingDirectory,
        timeout,
        maxBuffer: 1024 * 1024 * 20, // 20MB buffer for build output
        env: {
          ...process.env,
          NODE_ENV: environment,
          OPTIMIZE: optimize.toString(),
          SOURCE_MAPS: sourceMaps.toString(),
        },
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      let result = `🚀 Build completed successfully in ${duration}s\n\n`;

      if (stdout) {
        result += `Build Output:\n${stdout}\n\n`;
      }

      if (stderr) {
        result += `Build Warnings:\n${stderr}\n\n`;
      }

      // Check for build artifacts
      const artifacts = await this.findBuildArtifacts();
      if (artifacts.length > 0) {
        result += `📦 Build Artifacts Generated:\n${artifacts.join('\n')}\n\n`;
      }

      // Analyze build size if possible
      const sizeAnalysis = await this.analyzeBuildSize();
      if (sizeAnalysis) {
        result += `📊 Build Size Analysis:\n${sizeAnalysis}`;
      }

      return result;
    } catch (error) {
      let duration = 'failed';
      if (
        typeof error === 'object' &&
        error !== null &&
        'signal' in error &&
        (error as { signal?: unknown }).signal === 'SIGTERM'
      ) {
        duration = 'timed out';
      }

      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message)
          : String(error);

      const stdout =
        typeof error === 'object' &&
        error !== null &&
        'stdout' in error &&
        (error as { stdout?: unknown }).stdout
          ? `STDOUT:\n${String((error as { stdout?: unknown }).stdout)}\n`
          : '';

      const stderr =
        typeof error === 'object' &&
        error !== null &&
        'stderr' in error &&
        (error as { stderr?: unknown }).stderr
          ? `STDERR:\n${String((error as { stderr?: unknown }).stderr)}\n`
          : '';

      return `❌ Build ${duration}:\nError: ${message}\n${stdout}${stderr}`;
    }
  }

  private buildCommand(
    buildTool: string,
    buildScript: string | undefined,
    packageJson: PackageJson,
    environment: string,
    watch: boolean,
    optimize: boolean,
    sourceMaps: boolean
  ): string {
    // If custom build script is provided, use it
    if (buildScript) {
      return buildScript;
    }

    // Check package.json scripts
    const scripts =
      packageJson &&
      typeof packageJson === 'object' &&
      'scripts' in packageJson &&
      packageJson.scripts &&
      typeof packageJson.scripts === 'object'
        ? packageJson.scripts
        : {};

    switch (buildTool) {
      case 'npm': {
        if ('build' in scripts) return `npm run build${watch ? ':watch' : ''}`;
        if ('compile' in scripts) return 'npm run compile';
        return 'npm run build'; // Will fail if no build script
      }

      case 'yarn': {
        if ('build' in scripts) return `yarn build${watch ? ':watch' : ''}`;
        if ('compile' in scripts) return 'yarn compile';
        return 'yarn build';
      }

      case 'webpack': {
        let webpackCmd = 'npx webpack';
        if (environment === 'production') webpackCmd += ' --mode=production';
        if (environment === 'development') webpackCmd += ' --mode=development';
        if (watch) webpackCmd += ' --watch';
        if (optimize) webpackCmd += ' --optimize-minimize';
        if (sourceMaps) webpackCmd += ' --devtool source-map';
        return webpackCmd;
      }

      case 'vite': {
        if (watch) return 'npx vite';
        return 'npx vite build';
      }

      case 'rollup': {
        let rollupCmd = 'npx rollup -c';
        if (watch) rollupCmd += ' --watch';
        if (environment === 'production') rollupCmd += ' --environment NODE_ENV:production';
        return rollupCmd;
      }

      case 'tsc': {
        let tscCmd = 'npx tsc';
        if (watch) tscCmd += ' --watch';
        if (sourceMaps) tscCmd += ' --sourceMap';
        return tscCmd;
      }

      case 'esbuild': {
        let esbuildCmd = 'npx esbuild src/index.ts --bundle --outdir=dist';
        if (environment === 'production') esbuildCmd += ' --minify';
        if (sourceMaps) esbuildCmd += ' --sourcemap';
        if (watch) esbuildCmd += ' --watch';
        return esbuildCmd;
      }

      default:
        return 'npm run build';
    }
  }

  private async findBuildArtifacts(): Promise<string[]> {
    const commonBuildDirs = ['dist', 'build', 'out', 'lib', 'public'];
    const artifacts = [];

    for (const dir of commonBuildDirs) {
      try {
        const fullPath = join(this.agentContext.workingDirectory, dir);
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          const files = await fs.readdir(fullPath);
          if (files.length > 0) {
            artifacts.push(`${dir}/ (${files.length} files)`);
          }
        }
      } catch {
        // Directory doesn't exist, continue
      }
    }

    return artifacts;
  }

  private async analyzeBuildSize(): Promise<string | null> {
    const buildDirs = ['dist', 'build', 'out'];

    for (const dir of buildDirs) {
      try {
        const fullPath = join(this.agentContext.workingDirectory, dir);
        const size = await this.getDirectorySize(fullPath);
        if (size > 0) {
          return `${dir}: ${this.formatFileSize(size)}`;
        }
      } catch {
        // Directory doesn't exist or can't read
      }
    }

    return null;
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const itemPath = join(dirPath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          totalSize += await this.getDirectorySize(itemPath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch {
      // Error reading directory
    }

    return totalSize;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

const PackageManagerSchema = z.object({
  action: z
    .enum(['install', 'update', 'remove', 'list', 'audit', 'outdated', 'init', 'publish'])
    .describe('Package management action'),
  packages: z.array(z.string()).optional().describe('Package names (for install/remove/update)'),
  packageManager: z.enum(['npm', 'yarn', 'pnpm']).default('npm').describe('Package manager to use'),
  flags: z.array(z.string()).optional().describe('Additional flags (e.g., --save-dev, --global)'),
  force: z.boolean().default(false).describe('Force the operation'),
  timeout: z.number().default(120000).describe('Operation timeout in milliseconds'),
});

export class PackageManagerTool extends BaseTool<typeof PackageManagerSchema.shape> {
  public constructor(private readonly agentContext: Readonly<{ workingDirectory: string }>) {
    super({
      name: 'managePackages',
      description: 'Manages project dependencies and packages',
      category: 'Package Management',
      parameters: PackageManagerSchema,
    });
  }

  public async execute(args: Readonly<z.infer<typeof PackageManagerSchema>>): Promise<string> {
    try {
      const { action, packages, packageManager, flags, force, timeout } = args;

      const command = this.buildPackageCommand(action, packages, packageManager, flags, force);

      console.log(`Running package management command: ${command}`);

      const startTime = Date.now();

      const { stdout, stderr } = await execAsync(command, {
        cwd: this.agentContext.workingDirectory,
        timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      let result = `📦 Package ${action} completed in ${duration}s\n\n`;

      if (stdout) {
        result += `Output:\n${stdout}\n\n`;
      }

      if (stderr) {
        result += `Warnings/Info:\n${stderr}\n\n`;
      }

      // Add specific analysis based on action
      if (action === 'install' || action === 'update') {
        const analysis = await this.analyzePackageChanges();
        if (analysis) {
          result += `Package Analysis:\n${analysis}`;
        }
      }

      return result;
    } catch (error: unknown) {
      let message = 'Unknown error';
      let stdout = '';
      let stderr = '';
      if (typeof error === 'object' && error !== null) {
        if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
          message = String((error as { message?: unknown }).message);
        }
        if ('stdout' in error && typeof (error as { stdout?: unknown }).stdout === 'string') {
          stdout = `STDOUT:\n${String((error as { stdout?: unknown }).stdout)}\n`;
        }
        if ('stderr' in error && typeof (error as { stderr?: unknown }).stderr === 'string') {
          stderr = `STDERR:\n${String((error as { stderr?: unknown }).stderr)}\n`;
        }
      } else if (typeof error === 'string') {
        message = error;
      }
      return (
        `❌ Package ${args.action} failed:\n` + `Error: ${message}\n` + `${stdout}` + `${stderr}`
      );
    }
  }

  private buildPackageCommand(
    action: string,
    packages: ReadonlyArray<string> | undefined,
    packageManager: string,
    flags: ReadonlyArray<string> | undefined,
    force: boolean
  ): string {
    let command = packageManager;

    // Add action
    if (packageManager === 'npm') {
      switch (action) {
        case 'install':
          command +=
            packages && packages.length > 0 ? ` install ${packages.join(' ')}` : ' install';
          break;
        case 'update':
          command += packages && packages.length > 0 ? ` update ${packages.join(' ')}` : ' update';
          break;
        case 'remove':
          command += ` uninstall ${packages?.join(' ') ?? ''}`;
          break;
        case 'list':
          command += ' list';
          break;
        case 'audit':
          command += ' audit';
          if (force) command += ' --audit-level moderate';
          break;
        case 'outdated':
          command += ' outdated';
          break;
        case 'init':
          command += ' init';
          if (force) command += ' -y';
          break;
        case 'publish':
          command += ' publish';
          break;
        default:
          // No action, or unknown action
          switch (action) {
            case 'install':
              command +=
                packages && packages.length > 0 ? ` add ${packages.join(' ')}` : ' install';
              break;
            case 'update':
              command +=
                packages && packages.length > 0 ? ` upgrade ${packages.join(' ')}` : ' upgrade';
              break;
            case 'remove':
              command += ` remove ${packages?.join(' ') ?? ''}`;
              break;
            case 'list':
              command += ' list';
              break;
            case 'audit':
              command += ' audit';
              break;
            case 'outdated':
              command += ' outdated';
              break;
            case 'init':
              command += ' init';
              if (force) command += ' -y';
              break;
            case 'publish':
              command += ' publish';
              break;
            default:
              // No action, or unknown action
              break;
          }
          command += ' publish';
          break;
      }
    }

    // Add flags
    if (flags && flags.length > 0) {
      command += ` ${flags.join(' ')}`;
    }

    return command;
  }

  private async analyzePackageChanges(): Promise<string | null> {
    try {
      const packageJsonPath = join(this.agentContext.workingDirectory, 'package.json');
      const lockfilePath = join(this.agentContext.workingDirectory, 'package-lock.json');

      const [packageJsonRaw, lockfileExists] = await Promise.all([
        fs
          .readFile(packageJsonPath, 'utf-8')
          .then(data => JSON.parse(data) as unknown)
          .catch((): null => null),
        fs
          .access(lockfilePath)
          .then(() => true)
          .catch(() => false),
      ]);

      if (!packageJsonRaw || typeof packageJsonRaw !== 'object' || Array.isArray(packageJsonRaw))
        return null;

      const packageJson = packageJsonRaw as {
        dependencies?: Record<string, unknown>;
        devDependencies?: Record<string, unknown>;
      };

      let analysis = '';

      // Count dependencies
      const deps =
        packageJson.dependencies && typeof packageJson.dependencies === 'object'
          ? Object.keys(packageJson.dependencies).length
          : 0;
      const devDeps =
        packageJson.devDependencies && typeof packageJson.devDependencies === 'object'
          ? Object.keys(packageJson.devDependencies).length
          : 0;

      analysis += `Dependencies: ${deps} production, ${devDeps} development\n`;

      if (lockfileExists) {
        analysis += `✅ Lockfile present (package-lock.json)\n`;
      } else {
        analysis += `⚠️  No lockfile found\n`;
      }

      return analysis;
    } catch {
      return null;
    }
  }
}

const DeploySchema = z.object({
  deploymentTarget: z
    .enum(['vercel', 'netlify', 'heroku', 'aws', 'docker', 'github-pages', 'firebase'])
    .describe('Deployment target platform'),
  buildBeforeDeploy: z
    .boolean()
    .default(true)
    .describe('Whether to build the project before deployment'),
  environment: z
    .enum(['staging', 'production'])
    .default('production')
    .describe('Deployment environment'),
  environmentVariables: z
    .record(z.string())
    .optional()
    .describe('Environment variables for deployment'),
  deploymentConfig: z.string().optional().describe('Path to deployment configuration file'),
  dryRun: z
    .boolean()
    .default(false)
    .describe('Whether to perform a dry run without actual deployment'),
});

export class DeploymentTool extends BaseTool<typeof DeploySchema.shape> {
  public constructor(private readonly agentContext: Readonly<{ workingDirectory: string }>) {
    super({
      name: 'deployProject',
      description: 'Deploys the project to various hosting platforms',
      category: 'Deployment',
      parameters: DeploySchema,
    });
  }

  public async execute(args: Readonly<z.infer<typeof DeploySchema>>): Promise<string> {
    try {
      const {
        deploymentTarget,
        buildBeforeDeploy,
        environment,
        environmentVariables,
        deploymentConfig,
        dryRun,
      } = args;

      let result = `🚀 Starting deployment to ${deploymentTarget} (${environment})\n\n`;

      // Build before deployment if requested
      if (buildBeforeDeploy) {
        result += '📦 Building project...\n';
        try {
          await execAsync('npm run build', {
            cwd: this.agentContext.workingDirectory,
            timeout: 300000,
          });
          result += `Build completed successfully\n\n`;
        } catch (buildError) {
          const message =
            typeof buildError === 'object' && buildError !== null && 'message' in buildError
              ? String((buildError as { message?: unknown }).message)
              : String(buildError);
          return `❌ Build failed before deployment:\n${message}`;
        }
      }

      // Generate deployment command
      const deployCommand = this.buildDeploymentCommand(
        deploymentTarget,
        environment,
        deploymentConfig,
        dryRun
      );

      if (dryRun) {
        result += `🔍 Dry run - would execute: ${deployCommand}\n`;
        result += await this.validateDeploymentSetup(deploymentTarget);
        return result;
      }

      console.log(`Deploying with command: ${deployCommand}`);

      const { stdout, stderr } = await execAsync(deployCommand, {
        cwd: this.agentContext.workingDirectory,
        timeout: 600000, // 10 minutes for deployment
        maxBuffer: 1024 * 1024 * 20, // 20MB buffer
        env: {
          ...process.env,
          ...environmentVariables,
        },
      });

      if (stdout) {
        result += `Deployment Output:\n${stdout}\n\n`;
      }

      if (stderr) {
        result += `Deployment Info:\n${stderr}\n\n`;
      }

      result += `✅ Deployment to ${deploymentTarget} completed successfully!`;

      return result;
    } catch (error: unknown) {
      let message = 'Unknown error';
      let stdout = '';
      let stderr = '';
      if (typeof error === 'object' && error !== null) {
        if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
          message = String((error as { message?: unknown }).message);
        }
        if ('stdout' in error && typeof (error as { stdout?: unknown }).stdout === 'string') {
          stdout = `STDOUT:\n${String((error as { stdout?: unknown }).stdout)}\n`;
        }
        if ('stderr' in error && typeof (error as { stderr?: unknown }).stderr === 'string') {
          stderr = `STDERR:\n${String((error as { stderr?: unknown }).stderr)}\n`;
        }
      }
      return `❌ Deployment failed:\n` + `Error: ${message}\n` + `${stdout}` + `${stderr}`;
    }
  }

  private buildDeploymentCommand(
    target: string,
    environment: string,
    // envVars?: Readonly<Record<string, string>>, // Removed unused parameter
    configPath?: string,
    dryRun?: boolean
  ): string {
    const commands = {
      vercel: `npx vercel${environment === 'production' ? ' --prod' : ''}${dryRun ? ' --dry-run' : ''}`,
      netlify: `npx netlify deploy${environment === 'production' ? ' --prod' : ''}${dryRun ? ' --dry-run' : ''}`,
      heroku: `git push heroku ${environment === 'production' ? 'main' : 'staging'}`,
      'github-pages': `npx gh-pages -d dist`,
      firebase: `npx firebase deploy${configPath ? ` --config ${configPath}` : ''}`,
      aws: `npx aws s3 sync dist/ s3://your-bucket-name${dryRun ? ' --dryrun' : ''}`,
      docker: `docker build -t app . && docker run -p 3000:3000 app${dryRun ? ' --dry-run' : ''}`,
    };

    return (
      commands[target as keyof typeof commands] ||
      `echo "Deployment target ${target} not configured"`
    );
  }

  private async validateDeploymentSetup(target: string): Promise<string> {
    let validation = 'Deployment Setup Validation:\n';

    const requiredFiles = {
      vercel: ['vercel.json', 'package.json'],
      netlify: ['netlify.toml', 'package.json'],
      heroku: ['Procfile', 'package.json'],
      'github-pages': ['package.json'],
      firebase: ['firebase.json', '.firebaserc'],
      aws: ['package.json'],
      docker: ['Dockerfile', 'package.json'],
    };

    const files = requiredFiles[target as keyof typeof requiredFiles];

    for (const file of files) {
      try {
        await fs.access(join(this.agentContext.workingDirectory, file));
        validation += `✅ ${file} found\n`;
      } catch {
        validation += `❌ ${file} missing\n`;
      }
    }

    return validation;
  }
}
