// GitHub App - CodeCrucible Integration
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

const { App } = require('@octokit/app');
const { Octokit } = require('@octokit/rest');
const express = require('express');
const axios = require('axios');

class CodeCrucibleGitHubApp {
  constructor() {
    this.app = new App({
      appId: process.env.GITHUB_APP_ID,
      privateKey: process.env.GITHUB_PRIVATE_KEY,
      webhooks: {
        secret: process.env.GITHUB_WEBHOOK_SECRET,
      },
    });

    this.codeCrucibleApi = axios.create({
      baseURL: process.env.CODECRUCIBLE_API_URL || 'https://api.codecrucible.com',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CodeCrucible-GitHub-App/1.0.0'
      }
    });

    this.setupWebhooks();
    this.setupRoutes();
  }

  setupWebhooks() {
    // Pull Request Analysis - Multi-voice code review
    this.app.webhooks.on('pull_request.opened', async (context) => {
      await this.analyzePullRequest(context);
    });

    this.app.webhooks.on('pull_request.synchronize', async (context) => {
      await this.analyzePullRequest(context);
    });

    // Issue Triage - Voice recommendation for bug/feature classification
    this.app.webhooks.on('issues.opened', async (context) => {
      await this.triageIssue(context);
    });

    // Commit Review - Council-based commit analysis
    this.app.webhooks.on('push', async (context) => {
      await this.reviewCommits(context);
    });

    // Check Run - Code quality gates
    this.app.webhooks.on('check_suite.requested', async (context) => {
      await this.runQualityGate(context);
    });
  }

  setupRoutes() {
    this.server = express();
    this.server.use(express.json());

    // Health check endpoint
    this.server.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Webhook endpoint
    this.server.use('/api/github/webhooks', this.app.webhooks.middleware);

    // Manual analysis trigger
    this.server.post('/api/analyze', async (req, res) => {
      try {
        const { owner, repo, sha, analysisType } = req.body;
        
        const installation = await this.getInstallation(owner, repo);
        const octokit = await this.app.getInstallationOctokit(installation.id);
        
        const result = await this.performAnalysis(octokit, owner, repo, sha, analysisType);
        
        res.json(result);
      } catch (error) {
        console.error('Manual analysis failed:', error);
        res.status(500).json({ error: error.message });
      }
    });

    const port = process.env.PORT || 3000;
    this.server.listen(port, () => {
      console.log(`CodeCrucible GitHub App listening on port ${port}`);
    });
  }

  async analyzePullRequest(context) {
    console.log('🔍 Analyzing pull request:', context.payload.pull_request.number);
    
    try {
      const { owner, repo } = context.repo();
      const prNumber = context.payload.pull_request.number;
      const sha = context.payload.pull_request.head.sha;

      // Get changed files
      const files = await context.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });

      const changedFiles = files.data.filter(file => 
        file.status !== 'removed' && this.isSupportedFileType(file.filename)
      );

      if (changedFiles.length === 0) {
        console.log('No supported files changed, skipping analysis');
        return;
      }

      // Perform multi-voice analysis
      const analyses = await this.performMultiVoiceAnalysis(
        context.octokit, 
        owner, 
        repo, 
        changedFiles
      );

      // Create review comments
      await this.createReviewComments(context.octokit, owner, repo, prNumber, analyses);

      // Update check status
      await this.updateCheckStatus(
        context.octokit, 
        owner, 
        repo, 
        sha, 
        'codecrucible-analysis',
        'completed',
        'success',
        'AI Council analysis completed'
      );

    } catch (error) {
      console.error('PR analysis failed:', error);
      
      // Update check status as failed
      await this.updateCheckStatus(
        context.octokit,
        context.repo().owner,
        context.repo().repo,
        context.payload.pull_request.head.sha,
        'codecrucible-analysis',
        'completed',
        'failure',
        'AI Council analysis failed'
      );
    }
  }

  async performMultiVoiceAnalysis(octokit, owner, repo, files) {
    const analyses = [];

    for (const file of files) {
      try {
        // Get file content
        const content = await octokit.repos.getContent({
          owner,
          repo,
          path: file.filename,
          ref: file.sha
        });

        const fileContent = Buffer.from(content.data.content, 'base64').toString();

        // Analyze with different voice combinations
        const voiceAnalyses = await Promise.all([
          this.analyzeWithVoices(fileContent, file, ['Analyzer', 'Security Engineer'], 'security'),
          this.analyzeWithVoices(fileContent, file, ['Implementor', 'Performance Engineer'], 'performance'),
          this.analyzeWithVoices(fileContent, file, ['Maintainer', 'Systems Architect'], 'quality'),
          this.analyzeWithVoices(fileContent, file, ['Developer', 'UI/UX Engineer'], 'design')
        ]);

        analyses.push({
          file: file.filename,
          analyses: voiceAnalyses.filter(analysis => analysis !== null)
        });

      } catch (error) {
        console.error(`Failed to analyze file ${file.filename}:`, error);
      }
    }

    return analyses;
  }

  async analyzeWithVoices(content, file, voices, focusArea) {
    try {
      const prompt = this.createAnalysisPrompt(content, file, focusArea);
      
      const response = await this.codeCrucibleApi.post('/api/extensions/generate', {
        prompt,
        context: {
          language: this.detectLanguage(file.filename),
          filePath: file.filename,
          projectType: 'github',
          focusArea
        },
        voices: {
          perspectives: voices.filter(v => ['Analyzer', 'Maintainer', 'Developer', 'Implementor'].includes(v)),
          roles: voices.filter(v => ['Security Engineer', 'Performance Engineer', 'Systems Architect', 'UI/UX Engineer'].includes(v))
        },
        maxSolutions: 2
      }, {
        headers: {
          'x-codecrucible-api-key': process.env.CODECRUCIBLE_API_KEY
        }
      });

      return {
        focusArea,
        voices,
        solutions: response.data.solutions,
        sessionId: response.data.sessionId
      };

    } catch (error) {
      console.error(`Analysis failed for ${focusArea}:`, error);
      return null;
    }
  }

  createAnalysisPrompt(content, file, focusArea) {
    const prompts = {
      security: `Analyze this ${file.filename} file for security vulnerabilities, potential attack vectors, and security best practices. Focus on:
- Input validation and sanitization
- Authentication and authorization issues
- Data exposure risks
- Injection vulnerabilities
- Cryptographic implementations

File content:
${content}`,

      performance: `Analyze this ${file.filename} file for performance issues and optimization opportunities. Focus on:
- Algorithm efficiency and time complexity
- Memory usage and leaks
- Database query optimization
- Caching strategies
- Resource utilization

File content:
${content}`,

      quality: `Analyze this ${file.filename} file for code quality, maintainability, and best practices. Focus on:
- Code structure and organization
- Naming conventions and clarity
- Error handling and logging
- Documentation and comments
- Design patterns and principles

File content:
${content}`,

      design: `Analyze this ${file.filename} file for design quality and user experience. Focus on:
- Component architecture and reusability
- User interface consistency
- Accessibility compliance
- Responsive design patterns
- User interaction flows

File content:
${content}`
    };

    return prompts[focusArea] || prompts.quality;
  }

  async createReviewComments(octokit, owner, repo, prNumber, analyses) {
    for (const fileAnalysis of analyses) {
      for (const analysis of fileAnalysis.analyses) {
        if (analysis.solutions && analysis.solutions.length > 0) {
          // Create a summary comment for each focus area
          const comment = this.formatReviewComment(analysis, fileAnalysis.file);
          
          try {
            await octokit.pulls.createReview({
              owner,
              repo,
              pull_number: prNumber,
              body: comment,
              event: 'COMMENT'
            });
          } catch (error) {
            console.error('Failed to create review comment:', error);
          }
        }
      }
    }
  }

  formatReviewComment(analysis, filename) {
    const { focusArea, voices, solutions } = analysis;
    
    let comment = `## 🤖 CodeCrucible AI Council Review - ${focusArea.toUpperCase()}\n\n`;
    comment += `**File:** \`${filename}\`\n`;
    comment += `**Voices:** ${voices.join(', ')}\n\n`;

    solutions.forEach((solution, index) => {
      comment += `### ${solution.voiceType} Analysis (${Math.round(solution.confidence * 100)}% confidence)\n\n`;
      comment += `${solution.explanation}\n\n`;
      
      if (solution.code && solution.code.trim()) {
        comment += `**Suggested improvement:**\n\`\`\`\n${solution.code}\n\`\`\`\n\n`;
      }
    });

    comment += `---\n*Generated by CodeCrucible AI Council - [Learn more](https://codecrucible.com)*`;

    return comment;
  }

  isSupportedFileType(filename) {
    const supportedExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', 
      '.php', '.rb', '.cpp', '.c', '.h', '.cs', '.swift', '.kt'
    ];
    
    return supportedExtensions.some(ext => filename.endsWith(ext));
  }

  detectLanguage(filename) {
    const extensions = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascriptreact',
      '.tsx': 'typescriptreact',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.cs': 'csharp',
      '.swift': 'swift',
      '.kt': 'kotlin'
    };

    const ext = Object.keys(extensions).find(ext => filename.endsWith(ext));
    return extensions[ext] || 'text';
  }

  async updateCheckStatus(octokit, owner, repo, sha, name, status, conclusion, summary) {
    try {
      await octokit.checks.create({
        owner,
        repo,
        name,
        head_sha: sha,
        status,
        conclusion,
        output: {
          title: `CodeCrucible AI Council - ${conclusion}`,
          summary
        }
      });
    } catch (error) {
      console.error('Failed to update check status:', error);
    }
  }

  async getInstallation(owner, repo) {
    const installations = await this.app.eachInstallation.iterator();
    
    for await (const { installation } of installations) {
      const repos = await this.app.eachRepository.iterator({ installationId: installation.id });
      
      for await (const { repository } of repos) {
        if (repository.owner.login === owner && repository.name === repo) {
          return installation;
        }
      }
    }
    
    throw new Error('Installation not found');
  }

  async triageIssue(context) {
    // Implementation for issue triage with AI voices
    console.log('🏷️ Triaging issue:', context.payload.issue.number);
  }

  async reviewCommits(context) {
    // Implementation for commit review
    console.log('📝 Reviewing commits for:', context.payload.repository.full_name);
  }

  async runQualityGate(context) {
    // Implementation for quality gate checks
    console.log('🚦 Running quality gate for:', context.payload.repository.full_name);
  }
}

module.exports = CodeCrucibleGitHubApp;

// Start the app if called directly
if (require.main === module) {
  new CodeCrucibleGitHubApp();
}