
const { HuggingFaceTool } = require('./dist/mcp-tools/huggingface-tool.js');

async function main() {
  const config = {
    enabled: true,
    apiKey: require('fs').readFileSync('huggingface-api-key.txt', 'utf-8').trim(),
    baseUrl: 'https://huggingface.co/api',
    timeout: 30000,
  };

  const huggingFaceTool = new HuggingFaceTool(config);

  const recommendations = await huggingFaceTool.getModelRecommendations(
    'refactoring a javascript function',
    {
      preferredLibrary: 'react',
    }
  );

  console.log(recommendations);
}

main();
