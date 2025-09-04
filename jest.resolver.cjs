const { existsSync } = require('fs');
const path = require('path');

module.exports = (request, options) => {
  // Default resolver
  let resolvedPath;
  
  try {
    // First try the default resolver
    resolvedPath = options.defaultResolver(request, options);
  } catch (error) {
    // If the default resolver fails and the request ends with .js,
    // try resolving to a .ts file instead
    if (request.endsWith('.js')) {
      const tsRequest = request.replace(/\.js$/, '.ts');
      try {
        resolvedPath = options.defaultResolver(tsRequest, options);
      } catch (tsError) {
        // If both .js and .ts fail, check if we can find the file by trying different extensions
        const basePath = path.resolve(options.basedir, request.replace(/\.js$/, ''));
        
        // Try different extensions in order of preference
        const extensions = ['.ts', '.tsx', '.js', '.jsx'];
        for (const ext of extensions) {
          const testPath = basePath + ext;
          if (existsSync(testPath)) {
            return testPath;
          }
        }
        
        // If nothing works, re-throw the original error
        throw error;
      }
    } else {
      // Re-throw the original error if it's not a .js file
      throw error;
    }
  }
  
  return resolvedPath;
};