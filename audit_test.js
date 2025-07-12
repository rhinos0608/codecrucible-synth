// Direct audit test without authentication
const { openaiAuditor } = require('./server/openai-integration-audit.ts');

async function runAudit() {
  console.log('🔍 Starting comprehensive OpenAI integration audit...');
  console.log('📋 Checking compliance with AI_INSTRUCTIONS.md and CodingPhilosophy.md...\n');
  
  try {
    const auditResult = await openaiAuditor.auditIntegration();
    
    console.log('='.repeat(80));
    console.log('📊 AUDIT RESULTS');
    console.log('='.repeat(80));
    console.log(`Overall Status: ${auditResult.overallStatus}`);
    console.log(`✓ Pass: ${auditResult.summary.passCount}`);
    console.log(`⚠ Warning: ${auditResult.summary.warningCount}`);
    console.log(`✗ Fail: ${auditResult.summary.failCount}`);
    console.log();
    
    if (auditResult.summary.criticalIssues.length > 0) {
      console.log('🚨 CRITICAL ISSUES:');
      auditResult.summary.criticalIssues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
      console.log();
    }
    
    console.log('📋 DETAILED CHECKS:');
    console.log('-'.repeat(80));
    
    auditResult.checks.forEach(check => {
      const icon = check.status === 'PASS' ? '✅' : check.status === 'WARNING' ? '⚠️' : '❌';
      console.log(`${icon} [${check.category}] ${check.rule}`);
      console.log(`   Details: ${check.details}`);
      if (check.recommendation) {
        console.log(`   💡 Recommendation: ${check.recommendation}`);
      }
      console.log();
    });
    
    console.log('='.repeat(80));
    console.log('🎯 FRAMEWORK INTEGRATION SUMMARY:');
    console.log('='.repeat(80));
    
    const aiInstructionsChecks = auditResult.checks.filter(c => 
      c.category === 'Security' || c.category === 'Architecture'
    );
    const codingPhilosophyChecks = auditResult.checks.filter(c => 
      c.category === 'Philosophy' || c.category === 'Consciousness'
    );
    
    console.log(`🔒 AI_INSTRUCTIONS.md Compliance: ${aiInstructionsChecks.filter(c => c.status === 'PASS').length}/${aiInstructionsChecks.length}`);
    console.log(`🧠 CodingPhilosophy.md Compliance: ${codingPhilosophyChecks.filter(c => c.status === 'PASS').length}/${codingPhilosophyChecks.length}`);
    
    return auditResult;
  } catch (error) {
    console.error('❌ Audit failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export for reuse
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAudit };
} else {
  runAudit().then(result => {
    console.log('Audit completed successfully');
  });
}