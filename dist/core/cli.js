
class CLI {
  constructor(client, performanceMonitor = {}) {
    this.client = client;
  }
  
  async processPrompt(prompt, options = {}) {
    return {
      content: await this.client.generate(prompt),
      success: true
    };
  }
}

module.exports = { CLI };
