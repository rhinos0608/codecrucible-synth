
const { UnifiedModelClient } = require('./core/client.js');
const { CLI } = require('./core/cli.js');

class SimpleClient {
  constructor(config = {}) {
    this.config = config;
  }
  
  async generate(prompt, options = {}) {
    return "This is a placeholder response for: " + prompt.substring(0, 50) + "...";
  }
}

class SimpleCLI {
  constructor(client, performanceMonitor = {}) {
    this.client = client;
    this.performanceMonitor = performanceMonitor;
  }
  
  async processPrompt(prompt, options = {}) {
    return {
      content: await this.client.generate(prompt, options),
      success: true
    };
  }
}

async function initializeCLIContext() {
  const client = new SimpleClient();
  return new SimpleCLI(client);
}

module.exports = {
  CLI: SimpleCLI,
  UnifiedModelClient: SimpleClient,
  initializeCLIContext,
  default: initializeCLIContext
};
