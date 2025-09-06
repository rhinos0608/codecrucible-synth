#!/usr/bin/env node

/**
 * CodeCrucible Synth - Performance Validation Runner
 * Orchestrates comprehensive performance testing and generates production readiness assessment
 */

import { PerformanceValidator } from './performance-validation-suite.js';
import { StressTestRunner } from './stress-test-scenarios.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

class ProductionReadinessAssessment {
  constructor() {
    this.validationResults = null;
    this.stressTestResults = null;
    this.finalReport = null;
  }

  async runCompleteValidation() {
    console.log('🎯 CodeCrucible Synth - Complete Production Readiness Validation');
    console.log('================================================================');
    console.log('This comprehensive test suite validates the system for production deployment');
    console.log('by enterprise development teams.\n');

    const startTime = Date.now();

    try {
      // Phase 1: Core Performance Validation
      console.log('📊 PHASE 1: Core Performance Validation');
      console.log('─'.repeat(50));

      const validator = new PerformanceValidator();
      await validator.initialize();
      await validator.runValidationSuite();
      this.validationResults = validator.testResults;

      console.log('\n⏱️ Phase 1 completed. Preparing for stress testing...\n');
      await this.coolDown(3000);

      // Phase 2: Advanced Stress Testing
      console.log('⚡ PHASE 2: Advanced Stress Testing');
      console.log('─'.repeat(50));

      const stressTester = new StressTestRunner();
      await stressTester.initialize();
      await stressTester.runAllScenarios();
      this.stressTestResults = stressTester.results;

      // Phase 3: Generate Comprehensive Assessment
      console.log('\n📋 PHASE 3: Production Readiness Assessment');
      console.log('─'.repeat(50));

      await this.generateFinalAssessment(Date.now() - startTime);
    } catch (error) {
      console.error('❌ Validation failed:', error);
      throw error;
    }
  }

  async generateFinalAssessment(totalDuration) {
    const assessment = this.calculateProductionReadiness();

    this.finalReport = {
      timestamp: new Date().toISOString(),
      testDuration: Math.round(totalDuration / 1000),
      systemInfo: {
        nodeVersion: process.version,
        platform: `${os.platform()} ${os.arch()}`,
        cpuCores: os.cpus().length,
        totalMemoryGB: Math.round(os.totalmem() / 1024 / 1024 / 1024),
        freeMemoryGB: Math.round(os.freemem() / 1024 / 1024 / 1024),
      },
      performanceValidation: {
        totalTests: this.validationResults?.size || 0,
        passedTests: [...(this.validationResults?.values() || [])].filter(
          r => r.status === 'PASSED'
        ).length,
        summary: this.summarizeValidationResults(),
      },
      stressTesting: {
        totalScenarios: this.stressTestResults?.size || 0,
        passedScenarios: [...(this.stressTestResults?.values() || [])].filter(
          r => r.status === 'PASSED'
        ).length,
        summary: this.summarizeStressResults(),
      },
      productionReadiness: assessment,
      recommendations: this.generateRecommendations(assessment),
      metrics: this.calculateKeyMetrics(),
    };

    await this.displayFinalReport();
    await this.saveFinalReport();

    return this.finalReport;
  }

  calculateProductionReadiness() {
    const validationScore = this.calculateValidationScore();
    const stressScore = this.calculateStressScore();
    const overallScore = (validationScore + stressScore) / 2;

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      validationScore,
      stressScore,
      categories: {
        performance: this.assessPerformance(),
        reliability: this.assessReliability(),
        scalability: this.assessScalability(),
        resourceEfficiency: this.assessResourceEfficiency(),
        errorHandling: this.assessErrorHandling(),
        integrationStability: this.assessIntegrationStability(),
      },
      readinessLevel: this.determineReadinessLevel(overallScore),
    };
  }

  calculateValidationScore() {
    if (!this.validationResults) return 0;

    const totalTests = this.validationResults.size;
    const passedTests = [...this.validationResults.values()].filter(
      r => r.status === 'PASSED'
    ).length;

    return totalTests > 0 ? passedTests / totalTests : 0;
  }

  calculateStressScore() {
    if (!this.stressTestResults) return 0;

    const totalScenarios = this.stressTestResults.size;
    const passedScenarios = [...this.stressTestResults.values()].filter(
      r => r.status === 'PASSED'
    ).length;

    return totalScenarios > 0 ? passedScenarios / totalScenarios : 0;
  }

  assessPerformance() {
    const responseTimeTest = this.getValidationResult('Response Time Analysis');
    const concurrencyTest = this.getValidationResult('Concurrent Operation Handling');

    const responseTimeGood = responseTimeTest?.result?.p95ResponseTime < 3000;
    const concurrencyGood = concurrencyTest?.result?.maxConcurrency >= 10;

    return {
      score:
        responseTimeGood && concurrencyGood ? 1.0 : responseTimeGood || concurrencyGood ? 0.7 : 0.3,
      details: {
        responseTime: responseTimeGood ? 'EXCELLENT' : 'NEEDS_IMPROVEMENT',
        concurrency: concurrencyGood ? 'EXCELLENT' : 'NEEDS_IMPROVEMENT',
      },
    };
  }

  assessReliability() {
    const errorRecoveryTest = this.getValidationResult('Error Recovery Testing');
    const networkTest = this.getStressResult('network-instability-test');

    const errorRecoveryGood = errorRecoveryTest?.result?.gracefulDegradation === true;
    const networkStabilityGood = networkTest?.metrics?.systemStability === true;

    return {
      score:
        errorRecoveryGood && networkStabilityGood
          ? 1.0
          : errorRecoveryGood || networkStabilityGood
            ? 0.7
            : 0.3,
      details: {
        errorRecovery: errorRecoveryGood ? 'ROBUST' : 'FRAGILE',
        networkStability: networkStabilityGood ? 'STABLE' : 'UNSTABLE',
      },
    };
  }

  assessScalability() {
    const enterpriseTest = this.getStressResult('enterprise-team-simulation');
    const rapidFireTest = this.getStressResult('rapid-fire-requests');

    const enterpriseScaling =
      enterpriseTest?.metrics?.successfulOperations / enterpriseTest?.metrics?.totalOperations >=
      0.9;
    const burstHandling =
      rapidFireTest?.metrics?.requestsSuccessful / rapidFireTest?.metrics?.requestsSent >= 0.8;

    return {
      score:
        enterpriseScaling && burstHandling ? 1.0 : enterpriseScaling || burstHandling ? 0.7 : 0.3,
      details: {
        enterpriseScaling: enterpriseScaling ? 'EXCELLENT' : 'LIMITED',
        burstHandling: burstHandling ? 'GOOD' : 'POOR',
      },
    };
  }

  assessResourceEfficiency() {
    const memoryTest = this.getValidationResult('Memory Usage Patterns');
    const resourceTest = this.getValidationResult('Resource Management');

    const memoryEfficient = memoryTest?.result?.memoryLeaks?.length === 0;
    const resourceCleanup = resourceTest?.result?.resourceCleanup === true;

    return {
      score:
        memoryEfficient && resourceCleanup ? 1.0 : memoryEfficient || resourceCleanup ? 0.7 : 0.3,
      details: {
        memoryManagement: memoryEfficient ? 'EXCELLENT' : 'LEAKS_DETECTED',
        resourceCleanup: resourceCleanup ? 'CLEAN' : 'LEAKY',
      },
    };
  }

  assessErrorHandling() {
    const errorRecoveryTest = this.getValidationResult('Error Recovery Testing');
    const resourceExhaustionTest = this.getStressResult('resource-exhaustion-recovery');

    const errorHandlingGood = errorRecoveryTest?.result?.unhandledErrors === 0;
    const degradationGraceful = resourceExhaustionTest?.metrics?.gracefulDegradation === true;

    return {
      score:
        errorHandlingGood && degradationGraceful
          ? 1.0
          : errorHandlingGood || degradationGraceful
            ? 0.7
            : 0.3,
      details: {
        errorHandling: errorHandlingGood ? 'ROBUST' : 'WEAK',
        gracefulDegradation: degradationGraceful ? 'EXCELLENT' : 'POOR',
      },
    };
  }

  assessIntegrationStability() {
    const integrationTest = this.getValidationResult('Integration Stress Testing');
    const mcpTest = this.getValidationResult('MCP Integration Performance');

    const integrationStable = integrationTest?.result?.overallHealth === true;
    const mcpStable = mcpTest?.result?.connectionStability === true;

    return {
      score: integrationStable && mcpStable ? 1.0 : integrationStable || mcpStable ? 0.7 : 0.3,
      details: {
        overallIntegration: integrationStable ? 'STABLE' : 'UNSTABLE',
        mcpStability: mcpStable ? 'STABLE' : 'UNSTABLE',
      },
    };
  }

  determineReadinessLevel(score) {
    if (score >= 0.95) return 'PRODUCTION_READY';
    if (score >= 0.85) return 'READY_WITH_MONITORING';
    if (score >= 0.7) return 'READY_WITH_IMPROVEMENTS';
    if (score >= 0.5) return 'NOT_READY_SIGNIFICANT_ISSUES';
    return 'NOT_READY_MAJOR_ISSUES';
  }

  generateRecommendations(assessment) {
    const recommendations = [];

    if (assessment.categories.performance.score < 0.8) {
      recommendations.push({
        category: 'Performance',
        priority: 'HIGH',
        issue: 'Response times or concurrency handling needs improvement',
        solution: 'Optimize request processing pipeline and implement connection pooling',
      });
    }

    if (assessment.categories.reliability.score < 0.8) {
      recommendations.push({
        category: 'Reliability',
        priority: 'CRITICAL',
        issue: 'System reliability under stress conditions is insufficient',
        solution: 'Implement robust error recovery mechanisms and network fault tolerance',
      });
    }

    if (assessment.categories.scalability.score < 0.8) {
      recommendations.push({
        category: 'Scalability',
        priority: 'HIGH',
        issue: 'System may not handle enterprise-level loads effectively',
        solution: 'Implement horizontal scaling patterns and optimize resource utilization',
      });
    }

    if (assessment.categories.resourceEfficiency.score < 0.8) {
      recommendations.push({
        category: 'Resource Management',
        priority: 'MEDIUM',
        issue: 'Memory leaks or resource cleanup issues detected',
        solution: 'Review memory management patterns and implement proper resource disposal',
      });
    }

    if (assessment.categories.errorHandling.score < 0.8) {
      recommendations.push({
        category: 'Error Handling',
        priority: 'HIGH',
        issue: 'Error handling and recovery mechanisms need strengthening',
        solution: 'Implement comprehensive error boundaries and graceful degradation patterns',
      });
    }

    if (assessment.categories.integrationStability.score < 0.8) {
      recommendations.push({
        category: 'Integration',
        priority: 'MEDIUM',
        issue: 'MCP or external integration stability concerns',
        solution: 'Implement connection health monitoring and automatic reconnection logic',
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        category: 'General',
        priority: 'LOW',
        issue: 'System performing well overall',
        solution:
          'Continue monitoring in production and implement gradual performance optimizations',
      });
    }

    return recommendations;
  }

  calculateKeyMetrics() {
    const metrics = {
      totalTestsRun: (this.validationResults?.size || 0) + (this.stressTestResults?.size || 0),
      totalTestsPassed: this.getTotalPassedTests(),
      overallSuccessRate: 0,
      averageResponseTime: this.calculateAverageResponseTime(),
      memoryEfficiency: this.calculateMemoryEfficiency(),
      concurrencyCapacity: this.calculateConcurrencyCapacity(),
      errorRecoveryRate: this.calculateErrorRecoveryRate(),
    };

    metrics.overallSuccessRate =
      metrics.totalTestsRun > 0 ? (metrics.totalTestsPassed / metrics.totalTestsRun) * 100 : 0;

    return metrics;
  }

  getTotalPassedTests() {
    const validationPassed = [...(this.validationResults?.values() || [])].filter(
      r => r.status === 'PASSED'
    ).length;
    const stressPassed = [...(this.stressTestResults?.values() || [])].filter(
      r => r.status === 'PASSED'
    ).length;
    return validationPassed + stressPassed;
  }

  calculateAverageResponseTime() {
    const responseTest = this.getValidationResult('Response Time Analysis');
    return responseTest?.result?.averageResponseTime || 0;
  }

  calculateMemoryEfficiency() {
    const memoryTest = this.getValidationResult('Memory Usage Patterns');
    if (!memoryTest?.result) return 0;

    const hasLeaks = memoryTest.result.memoryLeaks.length > 0;
    const peakMemory = memoryTest.result.peakMemory;

    // Efficiency score based on lack of leaks and reasonable memory usage
    return hasLeaks ? 0.3 : peakMemory < 200 ? 1.0 : peakMemory < 500 ? 0.8 : 0.5;
  }

  calculateConcurrencyCapacity() {
    const concurrencyTest = this.getValidationResult('Concurrent Operation Handling');
    return concurrencyTest?.result?.maxConcurrency || 0;
  }

  calculateErrorRecoveryRate() {
    const errorTest = this.getValidationResult('Error Recovery Testing');
    if (!errorTest?.result) return 0;

    const total = errorTest.result.recoveredFromErrors + errorTest.result.unhandledErrors;
    return total > 0 ? errorTest.result.recoveredFromErrors / total : 0;
  }

  getValidationResult(testName) {
    return this.validationResults?.get(testName);
  }

  getStressResult(testKey) {
    return this.stressTestResults?.get(testKey);
  }

  summarizeValidationResults() {
    if (!this.validationResults) return 'No validation results available';

    const results = [...this.validationResults.values()];
    return {
      memoryManagement:
        results.find(r => r.result?.memoryLeaks)?.result?.memoryLeaks?.length === 0
          ? 'GOOD'
          : 'ISSUES',
      concurrency:
        results.find(r => r.result?.maxConcurrency)?.result?.maxConcurrency >= 10
          ? 'GOOD'
          : 'LIMITED',
      responseTime:
        results.find(r => r.result?.p95ResponseTime)?.result?.p95ResponseTime < 3000
          ? 'GOOD'
          : 'SLOW',
      errorRecovery: results.find(r => r.result?.gracefulDegradation)?.result?.gracefulDegradation
        ? 'ROBUST'
        : 'WEAK',
    };
  }

  summarizeStressResults() {
    if (!this.stressTestResults) return 'No stress test results available';

    const results = [...this.stressTestResults.values()];
    const passedCount = results.filter(r => r.status === 'PASSED').length;

    return {
      overallResilience: passedCount >= results.length * 0.8 ? 'HIGH' : 'MODERATE',
      loadHandling: results.find(r => r.metrics?.totalOperations) ? 'TESTED' : 'UNTESTED',
      memoryStability: results.find(r => r.metrics?.memoryStable === true) ? 'STABLE' : 'UNSTABLE',
      networkResilience: results.find(r => r.metrics?.systemStability === true) ? 'GOOD' : 'POOR',
    };
  }

  async displayFinalReport() {
    const report = this.finalReport;
    const assessment = report.productionReadiness;

    console.log('\n' + '═'.repeat(80));
    console.log('🎯 CODECRUCIBLE SYNTH - PRODUCTION READINESS ASSESSMENT');
    console.log('═'.repeat(80));

    console.log(`\n📅 Assessment Date: ${new Date(report.timestamp).toLocaleString()}`);
    console.log(`⏱️  Test Duration: ${report.testDuration}s`);
    console.log(`🖥️  System: ${report.systemInfo.nodeVersion} on ${report.systemInfo.platform}`);
    console.log(
      `💾 Memory: ${report.systemInfo.freeMemoryGB}GB free / ${report.systemInfo.totalMemoryGB}GB total`
    );

    console.log('\n📊 TEST EXECUTION SUMMARY');
    console.log('─'.repeat(40));
    console.log(
      `Performance Validation: ${report.performanceValidation.passedTests}/${report.performanceValidation.totalTests} passed`
    );
    console.log(
      `Stress Testing: ${report.stressTesting.passedScenarios}/${report.stressTesting.totalScenarios} passed`
    );
    console.log(`Overall Success Rate: ${report.metrics.overallSuccessRate.toFixed(1)}%`);

    console.log('\n🎯 PRODUCTION READINESS SCORES');
    console.log('─'.repeat(40));
    console.log(`Overall Score: ${(assessment.overallScore * 100).toFixed(1)}%`);
    console.log(`Performance: ${(assessment.categories.performance.score * 100).toFixed(1)}%`);
    console.log(`Reliability: ${(assessment.categories.reliability.score * 100).toFixed(1)}%`);
    console.log(`Scalability: ${(assessment.categories.scalability.score * 100).toFixed(1)}%`);
    console.log(
      `Resource Efficiency: ${(assessment.categories.resourceEfficiency.score * 100).toFixed(1)}%`
    );
    console.log(`Error Handling: ${(assessment.categories.errorHandling.score * 100).toFixed(1)}%`);
    console.log(
      `Integration Stability: ${(assessment.categories.integrationStability.score * 100).toFixed(1)}%`
    );

    console.log('\n📈 KEY PERFORMANCE METRICS');
    console.log('─'.repeat(40));
    console.log(`Average Response Time: ${Math.round(report.metrics.averageResponseTime)}ms`);
    console.log(
      `Concurrency Capacity: ${report.metrics.concurrencyCapacity} simultaneous operations`
    );
    console.log(`Memory Efficiency: ${(report.metrics.memoryEfficiency * 100).toFixed(1)}%`);
    console.log(`Error Recovery Rate: ${(report.metrics.errorRecoveryRate * 100).toFixed(1)}%`);

    console.log('\n🏆 PRODUCTION READINESS VERDICT');
    console.log('═'.repeat(40));

    const readinessEmoji = {
      PRODUCTION_READY: '🟢',
      READY_WITH_MONITORING: '🟡',
      READY_WITH_IMPROVEMENTS: '🟠',
      NOT_READY_SIGNIFICANT_ISSUES: '🔴',
      NOT_READY_MAJOR_ISSUES: '⚫',
    };

    const readinessMessages = {
      PRODUCTION_READY: 'EXCELLENT - Ready for immediate production deployment',
      READY_WITH_MONITORING: 'GOOD - Ready for production with enhanced monitoring',
      READY_WITH_IMPROVEMENTS: 'FAIR - Ready after implementing recommended improvements',
      NOT_READY_SIGNIFICANT_ISSUES: 'POOR - Significant issues must be resolved first',
      NOT_READY_MAJOR_ISSUES: 'CRITICAL - Major architectural issues require attention',
    };

    const emoji = readinessEmoji[assessment.readinessLevel] || '❓';
    const message = readinessMessages[assessment.readinessLevel] || 'Unknown readiness level';

    console.log(`${emoji} ${assessment.readinessLevel}: ${message}`);

    if (report.recommendations.length > 0) {
      console.log('\n💡 KEY RECOMMENDATIONS');
      console.log('─'.repeat(40));

      const highPriorityRecs = report.recommendations.filter(
        r => r.priority === 'CRITICAL' || r.priority === 'HIGH'
      );
      const otherRecs = report.recommendations.filter(
        r => r.priority !== 'CRITICAL' && r.priority !== 'HIGH'
      );

      if (highPriorityRecs.length > 0) {
        console.log('\n🔴 HIGH PRIORITY IMPROVEMENTS:');
        highPriorityRecs.forEach((rec, index) => {
          console.log(`   ${index + 1}. ${rec.category}: ${rec.solution}`);
        });
      }

      if (otherRecs.length > 0) {
        console.log('\n🟡 ADDITIONAL IMPROVEMENTS:');
        otherRecs.forEach((rec, index) => {
          console.log(`   ${index + 1}. ${rec.category}: ${rec.solution}`);
        });
      }
    }

    console.log('\n' + '═'.repeat(80));
  }

  async saveFinalReport() {
    const reportPath = path.join(process.cwd(), 'production-readiness-assessment.json');
    await fs.writeFile(reportPath, JSON.stringify(this.finalReport, null, 2));

    // Also save a markdown summary
    const markdownReport = this.generateMarkdownSummary();
    const markdownPath = path.join(process.cwd(), 'production-readiness-summary.md');
    await fs.writeFile(markdownPath, markdownReport);

    console.log(`\n📄 Detailed assessment saved to: ${reportPath}`);
    console.log(`📄 Summary report saved to: ${markdownPath}`);
  }

  generateMarkdownSummary() {
    const report = this.finalReport;
    const assessment = report.productionReadiness;

    return `# CodeCrucible Synth - Production Readiness Assessment

## Executive Summary

**Assessment Date:** ${new Date(report.timestamp).toLocaleString()}  
**Test Duration:** ${report.testDuration} seconds  
**Overall Score:** ${(assessment.overallScore * 100).toFixed(1)}%  
**Readiness Level:** ${assessment.readinessLevel}

## Test Results Summary

- **Performance Validation:** ${report.performanceValidation.passedTests}/${report.performanceValidation.totalTests} tests passed
- **Stress Testing:** ${report.stressTesting.passedScenarios}/${report.stressTesting.totalScenarios} scenarios passed
- **Overall Success Rate:** ${report.metrics.overallSuccessRate.toFixed(1)}%

## Category Scores

| Category | Score | Status |
|----------|-------|--------|
| Performance | ${(assessment.categories.performance.score * 100).toFixed(1)}% | ${this.getStatusEmoji(assessment.categories.performance.score)} |
| Reliability | ${(assessment.categories.reliability.score * 100).toFixed(1)}% | ${this.getStatusEmoji(assessment.categories.reliability.score)} |
| Scalability | ${(assessment.categories.scalability.score * 100).toFixed(1)}% | ${this.getStatusEmoji(assessment.categories.scalability.score)} |
| Resource Efficiency | ${(assessment.categories.resourceEfficiency.score * 100).toFixed(1)}% | ${this.getStatusEmoji(assessment.categories.resourceEfficiency.score)} |
| Error Handling | ${(assessment.categories.errorHandling.score * 100).toFixed(1)}% | ${this.getStatusEmoji(assessment.categories.errorHandling.score)} |
| Integration Stability | ${(assessment.categories.integrationStability.score * 100).toFixed(1)}% | ${this.getStatusEmoji(assessment.categories.integrationStability.score)} |

## Key Performance Metrics

- **Average Response Time:** ${Math.round(report.metrics.averageResponseTime)}ms
- **Concurrency Capacity:** ${report.metrics.concurrencyCapacity} simultaneous operations
- **Memory Efficiency:** ${(report.metrics.memoryEfficiency * 100).toFixed(1)}%
- **Error Recovery Rate:** ${(report.metrics.errorRecoveryRate * 100).toFixed(1)}%

## Recommendations

${report.recommendations
  .map(
    rec =>
      `### ${rec.category} (${rec.priority} Priority)\n**Issue:** ${rec.issue}\n**Solution:** ${rec.solution}\n`
  )
  .join('\n')}

## Production Deployment Guidance

Based on the assessment score of ${(assessment.overallScore * 100).toFixed(1)}%, the system is classified as **${assessment.readinessLevel}**.

${this.getDeploymentGuidance(assessment.readinessLevel)}

---
*Generated by CodeCrucible Synth Production Readiness Assessment Tool*`;
  }

  getStatusEmoji(score) {
    if (score >= 0.9) return '🟢 Excellent';
    if (score >= 0.8) return '🟡 Good';
    if (score >= 0.6) return '🟠 Fair';
    return '🔴 Needs Work';
  }

  getDeploymentGuidance(readinessLevel) {
    const guidance = {
      PRODUCTION_READY:
        '✅ **Ready for Production**: System can be deployed immediately with confidence. Implement standard monitoring and logging.',
      READY_WITH_MONITORING:
        '⚠️ **Deploy with Caution**: System is functional but requires enhanced monitoring. Implement comprehensive alerting and gradual rollout.',
      READY_WITH_IMPROVEMENTS:
        '⏳ **Improvements Needed**: Address high-priority recommendations before production deployment. Consider staged rollout after fixes.',
      NOT_READY_SIGNIFICANT_ISSUES:
        '🛑 **Not Ready**: Resolve critical issues before considering production deployment. Extensive testing required after fixes.',
      NOT_READY_MAJOR_ISSUES:
        '🚨 **Major Issues**: Significant architectural changes needed. Complete redesign of failing components recommended.',
    };

    return guidance[readinessLevel] || 'Unknown readiness level - manual assessment required.';
  }

  async coolDown(ms) {
    console.log(`⏳ Cooling down for ${ms / 1000}s between test phases...`);
    await new Promise(resolve => setTimeout(resolve, ms));
    if (global.gc) global.gc(); // Force garbage collection
  }
}

// Main execution function
async function main() {
  const assessment = new ProductionReadinessAssessment();

  try {
    console.log('🚀 Starting comprehensive production readiness validation...\n');
    await assessment.runCompleteValidation();

    console.log('\n🎉 Production readiness assessment completed successfully!');
    console.log('Check the generated reports for detailed analysis and recommendations.');
  } catch (error) {
    console.error('\n❌ Production readiness assessment failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ProductionReadinessAssessment };
