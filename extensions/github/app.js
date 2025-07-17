// GitHub App - CodeCrucible Multi-Voice AI Integration
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

const { App } = require('@octokit/app');
const { Webhooks } = require('@octokit/webhooks');
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

    // Health check
    this.server.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        app: 'codecrucible-github-app'
      });
    });

    // Manual PR analysis trigger
    this.server.post('/analyze/:owner/:repo/:pr', async (req, res) => {
      try {
        const { owner, repo, pr } = req.params;
        const installation = await this.getInstallation(owner, repo);
        
        if (!installation) {
          return res.status(404).json({ error: 'Installation not found' });
        }

        const analysis = await this.performPRAnalysis(installation, owner, repo, pr);
        res.json(analysis);
      } catch (error) {
        console.error('Manual PR analysis failed:', error);
        res.status(500).json({ error: 'Analysis failed' });
      }
    });

    // Webhook endpoint
    this.server.post('/webhooks', this.app.webhooks.middleware);

    const port = process.env.PORT || 3000;
    this.server.listen(port, () => {
      console.log(`CodeCrucible GitHub App listening on port ${port}`);
    });
  }

  async analyzePullRequest(context) {
    try {
      const { pull_request: pr, repository: repo } = context.payload;
      
      console.log(`🔍 Analyzing PR #${pr.number} in ${repo.full_name}`);

      // Get PR diff and files
      const octokit = await this.app.getInstallationOctokit(context.payload.installation.id);
      
      const { data: files } = await octokit.rest.pulls.listFiles({
        owner: repo.owner.login,
        repo: repo.name,
        pull_number: pr.number,
      });

      // Extract code changes for analysis
      const codeChanges = await this.extractCodeChanges(files);
      
      // Get voice recommendations based on PR content
      const voiceRecommendations = await this.getVoiceRecommendations(
        pr.title + '\n' + pr.body,
        { type: 'pull_request', files: files.map(f => f.filename) }
      );

      // Generate multi-voice analysis
      const analysis = await this.generateCouncilAnalysis({
        prompt: `Analyze this pull request for code quality, potential issues, and best practices:\n\nTitle: ${pr.title}\nDescription: ${pr.body}\n\nCode Changes:\n${codeChanges}`,
        context: {
          language: this.detectPrimaryLanguage(files),
          projectType: 'pull_request',
          repository: repo.full_name,
          author: pr.user.login
        },
        voices: voiceRecommendations,
        synthesisMode: 'consensus'
      });

      // Post analysis as PR comment
      await this.postPRComment(octokit, repo, pr.number, analysis);

      // Update check status
      await this.updateCheckStatus(octokit, repo, pr.head.sha, analysis);

      console.log(`✅ PR #${pr.number} analysis completed`);

    } catch (error) {
      console.error('PR analysis failed:', error);
      await this.postErrorComment(context, error);
    }
  }

  async triageIssue(context) {
    try {
      const { issue, repository: repo } = context.payload;
      
      console.log(`🏷️ Triaging issue #${issue.number} in ${repo.full_name}`);

      // Analyze issue content for classification
      const classification = await this.classifyIssue({
        title: issue.title,
        body: issue.body,
        labels: issue.labels.map(l => l.name)
      });

      const octokit = await this.app.getInstallationOctokit(context.payload.installation.id);

      // Add recommended labels
      if (classification.recommendedLabels.length > 0) {
        await octokit.rest.issues.addLabels({
          owner: repo.owner.login,
          repo: repo.name,
          issue_number: issue.number,
          labels: classification.recommendedLabels
        });
      }

      // Post triage analysis comment
      await this.postIssueTriageComment(octokit, repo, issue.number, classification);

      console.log(`✅ Issue #${issue.number} triaged with labels: ${classification.recommendedLabels.join(', ')}`);

    } catch (error) {
      console.error('Issue triage failed:', error);
    }
  }

  async reviewCommits(context) {
    try {
      const { commits, repository: repo } = context.payload;
      
      if (commits.length === 0) return;

      console.log(`📝 Reviewing ${commits.length} commits in ${repo.full_name}`);

      const octokit = await this.app.getInstallationOctokit(context.payload.installation.id);

      for (const commit of commits) {
        // Skip merge commits
        if (commit.message.startsWith('Merge')) continue;

        // Get commit diff
        const { data: commitData } = await octokit.rest.repos.getCommit({
          owner: repo.owner.login,
          repo: repo.name,
          ref: commit.id
        });

        // Analyze commit for quality and best practices
        const analysis = await this.analyzeCommit(commit, commitData);

        // Post commit comment if issues found
        if (analysis.issues.length > 0) {
          await this.postCommitComment(octokit, repo, commit.id, analysis);
        }
      }

      console.log(`✅ Commit review completed for ${commits.length} commits`);

    } catch (error) {
      console.error('Commit review failed:', error);
    }
  }

  async runQualityGate(context) {
    try {
      const { check_suite: checkSuite, repository: repo } = context.payload;
      
      console.log(`🛡️ Running quality gate for ${repo.full_name} @ ${checkSuite.head_sha}`);

      const octokit = await this.app.getInstallationOctokit(context.payload.installation.id);

      // Create check run
      const { data: checkRun } = await octokit.rest.checks.create({
        owner: repo.owner.login,
        repo: repo.name,
        name: 'CodeCrucible Quality Gate',
        head_sha: checkSuite.head_sha,
        status: 'in_progress',
        started_at: new Date().toISOString()
      });

      try {
        // Get repository files for analysis
        const { data: tree } = await octokit.rest.git.getTree({
          owner: repo.owner.login,
          repo: repo.name,
          tree_sha: checkSuite.head_sha,
          recursive: true
        });

        // Analyze code quality
        const qualityAnalysis = await this.performQualityAnalysis(tree, repo);

        // Update check run with results
        await octokit.rest.checks.update({
          owner: repo.owner.login,
          repo: repo.name,
          check_run_id: checkRun.id,
          status: 'completed',
          conclusion: qualityAnalysis.passed ? 'success' : 'failure',
          completed_at: new Date().toISOString(),
          output: {
            title: 'CodeCrucible Quality Gate',
            summary: qualityAnalysis.summary,
            text: qualityAnalysis.details
          }
        });

        console.log(`✅ Quality gate ${qualityAnalysis.passed ? 'passed' : 'failed'} for ${repo.full_name}`);

      } catch (analysisError) {
        // Update check run with error
        await octokit.rest.checks.update({
          owner: repo.owner.login,
          repo: repo.name,
          check_run_id: checkRun.id,
          status: 'completed',
          conclusion: 'failure',
          completed_at: new Date().toISOString(),
          output: {
            title: 'CodeCrucible Quality Gate',
            summary: 'Quality analysis failed',
            text: `Error: ${analysisError.message}`
          }
        });
      }

    } catch (error) {
      console.error('Quality gate failed:', error);
    }
  }

  async generateCouncilAnalysis(request) {
    try {
      const response = await this.codeCrucibleApi.post('/api/extensions/generate', request, {
        headers: {
          'x-codecrucible-api-key': process.env.CODECRUCIBLE_API_KEY
        }
      });

      return response.data;
    } catch (error) {
      console.error('Council analysis failed:', error);
      throw new Error('Failed to generate AI analysis');
    }
  }

  async getVoiceRecommendations(text, context) {
    try {
      const response = await this.codeCrucibleApi.post('/api/extensions/recommendations', {
        prompt: text,
        context
      }, {
        headers: {
          'x-codecrucible-api-key': process.env.CODECRUCIBLE_API_KEY
        }
      });

      return response.data.recommendations[0]?.voices || {
        perspectives: ['Analyzer', 'Maintainer'],
        roles: ['Security Engineer', 'Systems Architect']
      };
    } catch (error) {
      console.error('Voice recommendations failed:', error);
      return {
        perspectives: ['Analyzer', 'Maintainer'],
        roles: ['Security Engineer', 'Systems Architect']
      };
    }
  }

  async extractCodeChanges(files) {
    let changes = '';
    for (const file of files.slice(0, 10)) { // Limit to first 10 files
      if (file.patch) {
        changes += `\n### ${file.filename}\n${file.patch}\n`;
      }
    }
    return changes;
  }

  detectPrimaryLanguage(files) {
    const extensions = files.map(f => f.filename.split('.').pop()).filter(Boolean);
    const counts = {};
    
    extensions.forEach(ext => {
      counts[ext] = (counts[ext] || 0) + 1;
    });

    const primary = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, '');
    
    const languageMap = {
      js: 'javascript',
      ts: 'typescript',
      jsx: 'javascript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      swift: 'swift',
      kt: 'kotlin'
    };

    return languageMap[primary] || 'unknown';
  }

  async postPRComment(octokit, repo, prNumber, analysis) {
    let comment = '## 🧠 CodeCrucible AI Council Analysis\n\n';
    
    if (analysis.solutions) {
      analysis.solutions.forEach((solution, index) => {
        comment += `### ${solution.voiceType} Analysis\n`;
        comment += `**Confidence**: ${(solution.confidence * 100).toFixed(1)}%\n\n`;
        comment += `${solution.explanation}\n\n`;
        
        if (solution.code && solution.code.trim()) {
          comment += '**Suggested Improvements**:\n';
          comment += `\`\`\`diff\n${solution.code}\n\`\`\`\n\n`;
        }
        
        comment += '---\n\n';
      });
    }

    comment += '*Generated by CodeCrucible AI Council - Multi-voice consciousness-driven development*';

    await octokit.rest.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: prNumber,
      body: comment
    });
  }

  async updateCheckStatus(octokit, repo, sha, analysis) {
    const passed = analysis.solutions.every(s => s.confidence > 0.7);
    
    await octokit.rest.repos.createCommitStatus({
      owner: repo.owner.login,
      repo: repo.name,
      sha: sha,
      state: passed ? 'success' : 'failure',
      context: 'codecrucible/ai-council',
      description: passed ? 'AI Council analysis passed' : 'AI Council found issues',
      target_url: `https://codecrucible.com/analysis/${analysis.sessionId}`
    });
  }

  async classifyIssue(issue) {
    // Simple classification logic - in production, use AI classification
    const { title, body } = issue;
    const text = (title + ' ' + body).toLowerCase();
    
    const recommendedLabels = [];
    
    if (text.includes('bug') || text.includes('error') || text.includes('crash')) {
      recommendedLabels.push('bug');
    }
    
    if (text.includes('feature') || text.includes('enhancement') || text.includes('add')) {
      recommendedLabels.push('enhancement');
    }
    
    if (text.includes('security') || text.includes('vulnerability')) {
      recommendedLabels.push('security');
    }
    
    if (text.includes('performance') || text.includes('slow') || text.includes('optimize')) {
      recommendedLabels.push('performance');
    }

    if (text.includes('documentation') || text.includes('docs')) {
      recommendedLabels.push('documentation');
    }

    return {
      recommendedLabels,
      classification: recommendedLabels[0] || 'general',
      confidence: 0.8
    };
  }

  async postIssueTriageComment(octokit, repo, issueNumber, classification) {
    const comment = `## 🏷️ CodeCrucible Issue Triage\n\n` +
      `**Classification**: ${classification.classification}\n` +
      `**Confidence**: ${(classification.confidence * 100).toFixed(1)}%\n` +
      `**Recommended Labels**: ${classification.recommendedLabels.join(', ')}\n\n` +
      `*Automatically triaged by CodeCrucible AI*`;

    await octokit.rest.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: issueNumber,
      body: comment
    });
  }

  async analyzeCommit(commit, commitData) {
    // Simple commit analysis - in production, use AI analysis
    const issues = [];
    
    // Check commit message quality
    if (commit.message.length < 10) {
      issues.push('Commit message is too short (< 10 characters)');
    }
    
    if (!commit.message.match(/^[A-Z]/)) {
      issues.push('Commit message should start with a capital letter');
    }
    
    // Check for large commits
    if (commitData.stats && commitData.stats.total > 500) {
      issues.push(`Large commit (${commitData.stats.total} changes) - consider breaking into smaller commits`);
    }
    
    return {
      issues,
      suggestions: issues.length > 0 ? ['Follow conventional commit format', 'Keep commits atomic and focused'] : []
    };
  }

  async postCommitComment(octokit, repo, commitSha, analysis) {
    let comment = '## ⚠️ CodeCrucible Commit Review\n\n';
    
    if (analysis.issues.length > 0) {
      comment += '**Issues Found**:\n';
      analysis.issues.forEach(issue => {
        comment += `- ${issue}\n`;
      });
      comment += '\n';
    }
    
    if (analysis.suggestions.length > 0) {
      comment += '**Suggestions**:\n';
      analysis.suggestions.forEach(suggestion => {
        comment += `- ${suggestion}\n`;
      });
    }
    
    comment += '\n*Generated by CodeCrucible AI Council*';

    await octokit.rest.repos.createCommitComment({
      owner: repo.owner.login,
      repo: repo.name,
      commit_sha: commitSha,
      body: comment
    });
  }

  async performQualityAnalysis(tree, repo) {
    // Simple quality analysis - in production, use AI analysis
    const codeFiles = tree.tree.filter(item => 
      item.type === 'blob' && 
      /\.(js|ts|jsx|tsx|py|java|cpp|c|cs|php|rb|go|rs|swift|kt)$/.test(item.path)
    );
    
    const testFiles = tree.tree.filter(item => 
      item.type === 'blob' && 
      /\.(test|spec)\.(js|ts|jsx|tsx|py|java)$/.test(item.path)
    );
    
    const testCoverage = testFiles.length / Math.max(codeFiles.length, 1);
    const passed = testCoverage > 0.3; // Require at least 30% test coverage
    
    return {
      passed,
      summary: passed ? 
        `Quality gate passed - ${(testCoverage * 100).toFixed(1)}% test coverage` :
        `Quality gate failed - Only ${(testCoverage * 100).toFixed(1)}% test coverage (minimum 30% required)`,
      details: `**Analysis Results**:\n` +
        `- Code files: ${codeFiles.length}\n` +
        `- Test files: ${testFiles.length}\n` +
        `- Test coverage: ${(testCoverage * 100).toFixed(1)}%\n` +
        `- Repository: ${repo.full_name}`
    };
  }

  async postErrorComment(context, error) {
    try {
      const octokit = await this.app.getInstallationOctokit(context.payload.installation.id);
      const { pull_request: pr, repository: repo } = context.payload;
      
      const comment = `## ❌ CodeCrucible Analysis Error\n\n` +
        `Unfortunately, the AI council analysis failed with the following error:\n` +
        `\`\`\`\n${error.message}\n\`\`\`\n\n` +
        `Please try again later or contact support if the issue persists.`;
      
      await octokit.rest.issues.createComment({
        owner: repo.owner.login,
        repo: repo.name,
        issue_number: pr.number,
        body: comment
      });
    } catch (commentError) {
      console.error('Failed to post error comment:', commentError);
    }
  }

  async getInstallation(owner, repo) {
    try {
      const { data: installation } = await this.app.octokit.rest.apps.getRepoInstallation({
        owner,
        repo
      });
      return installation;
    } catch (error) {
      console.error('Installation not found:', error);
      return null;
    }
  }
}

// Initialize and start the GitHub App
if (require.main === module) {
  const app = new CodeCrucibleGitHubApp();
  console.log('🚀 CodeCrucible GitHub App started');
}

module.exports = CodeCrucibleGitHubApp;