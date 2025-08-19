// Sample JavaScript file for testing code analysis
function calculateSum(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('Both arguments must be numbers');
  }
  return a + b;
}

class Calculator {
  constructor() {
    this.history = [];
  }
  
  add(a, b) {
    const result = a + b;
    this.history.push({ operation: 'add', a, b, result });
    return result;
  }
  
  multiply(a, b) {
    const result = a * b;
    this.history.push({ operation: 'multiply', a, b, result });
    return result;
  }
  
  getHistory() {
    return this.history;
  }
}

module.exports = { calculateSum, Calculator };