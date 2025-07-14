#!/usr/bin/env node

/**
 * Comprehensive Compliance Audit Script
 * Audits codebase against AI_INSTRUCTIONS.md, FRONTEND.md, and CodingPhilosophy.md
 * Following Jung's Descent Protocol and Alexander's Pattern Language principles
 */

import fs from 'fs';
import path from 'path';

class ComplianceAuditor {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.qwanScore = 0;
    this.consciousnessLevel = 0;
  }

  // Jung's Descent Protocol: Recursive file traversal for consciousness audit
  auditReactImports(dir = 'client/src') {
    const files = this.getFiles(dir, ['.tsx', '.ts']);
    let violations = 0;

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      
      // AI_INSTRUCTIONS.md violation: Explicit React imports
      if (content.includes('import React') || content.match(/React\./g)) {
        this.issues.push({
          type: 'CRITICAL',
          rule: 'AI_INSTRUCTIONS.md - React Import Violation',
          file: file,
          description: 'Uses explicit React imports or React.* references',
          consciousnessImpact: -2
        });
        violations++;
      }

      // Missing imports for hooks used
      const reactHooks = ['useState', 'useEffect', 'useCallback', 'useMemo', 'useContext', 'createContext'];
      reactHooks.forEach(hook => {
        if (content.includes(hook) && !content.includes(`import { ${hook}`)) {
          this.warnings.push({
            type: 'WARNING',
            rule: 'AI_INSTRUCTIONS.md - Missing Hook Import',
            file: file,
            description: `Uses ${hook} but missing direct import`
          });
        }
      });
    });

    return violations;
  }

  // Alexander's Pattern Language: UI component accessibility audit
  auditDialogAccessibility(dir = 'client/src/components') {
    const files = this.getFiles(dir, ['.tsx']);
    let violations = 0;

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      
      // DialogContent without DialogDescription
      if (content.includes('DialogContent') && !content.includes('DialogDescription')) {
        this.issues.push({
          type: 'CRITICAL',
          rule: 'FRONTEND.md - Accessibility Violation',
          file: file,
          description: 'DialogContent missing required DialogDescription',
          qwanImpact: -3
        });
        violations++;
      }
    });

    return violations;
  }

  // CodingPhilosophy.md: QWAN assessment audit
  auditQWANImplementation(dir = 'client/src/components') {
    const files = this.getFiles(dir, ['.tsx']);
    let qwanComponents = 0;

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for QWAN consciousness patterns
      if (content.includes('QWAN') || content.includes('Quality Without A Name')) {
        qwanComponents++;
        this.qwanScore += 2;
      }

      // Check for consciousness-driven development patterns
      if (content.includes("Jung's Descent") || content.includes("Alexander's Pattern") || content.includes("Campbell's Mythic")) {
        this.consciousnessLevel += 1;
      }
    });

    return qwanComponents;
  }

  // Server-side logging audit
  auditServerLogging(dir = 'server') {
    const files = this.getFiles(dir, ['.ts', '.js']);
    let violations = 0;

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      
      // AI_INSTRUCTIONS.md violation: console.log in server code
      const consoleMatches = content.match(/console\.log/g);
      if (consoleMatches) {
        this.issues.push({
          type: 'WARNING',
          rule: 'AI_INSTRUCTIONS.md - Server Logging Violation',
          file: file,
          description: `Found ${consoleMatches.length} console.log statements - use structured logging`,
          count: consoleMatches.length
        });
        violations += consoleMatches.length;
      }
    });

    return violations;
  }

  // Helper methods
  getFiles(dir, extensions) {
    let results = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat && stat.isDirectory()) {
        results = results.concat(this.getFiles(filePath, extensions));
      } else if (extensions.some(ext => file.endsWith(ext))) {
        results.push(filePath);
      }
    });
    
    return results;
  }

  // Comprehensive audit execution
  runAudit() {
    console.log('🧠 Comprehensive CodeCrucible Compliance Audit');
    console.log('Following Jung\'s Descent Protocol, Alexander\'s Pattern Language, and Campbell\'s Mythic Journey\n');

    // Critical audits
    const reactViolations = this.auditReactImports();
    const dialogViolations = this.auditDialogAccessibility();
    const serverLogViolations = this.auditServerLogging();
    const qwanComponents = this.auditQWANImplementation();

    // Generate comprehensive report
    this.generateReport(reactViolations, dialogViolations, serverLogViolations, qwanComponents);
  }

  generateReport(reactViolations, dialogViolations, serverLogViolations, qwanComponents) {
    console.log('📊 AUDIT RESULTS\n');
    
    // Critical Issues
    console.log('🚨 CRITICAL ISSUES:');
    console.log(`   React Import Violations: ${reactViolations}`);
    console.log(`   Dialog Accessibility Issues: ${dialogViolations}`);
    console.log(`   Server Logging Issues: ${serverLogViolations}`);
    
    // Consciousness Metrics
    console.log('\n🧘 CONSCIOUSNESS METRICS:');
    console.log(`   QWAN Score: ${this.qwanScore}/100`);
    console.log(`   Consciousness Level: ${this.consciousnessLevel}/20`);
    console.log(`   Components with QWAN: ${qwanComponents}`);

    // Detailed Issues
    if (this.issues.length > 0) {
      console.log('\n📋 DETAILED ISSUES:');
      this.issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. [${issue.type}] ${issue.rule}`);
        console.log(`   File: ${issue.file}`);
        console.log(`   Issue: ${issue.description}`);
        if (issue.count) console.log(`   Count: ${issue.count}`);
      });
    }

    // Production Readiness Assessment
    const totalIssues = this.issues.filter(i => i.type === 'CRITICAL').length;
    const grade = this.calculateGrade(totalIssues, this.qwanScore, this.consciousnessLevel);
    
    console.log(`\n🎯 PRODUCTION READINESS: ${grade.letter} (${grade.score}/100)`);
    console.log(`   Blocking Issues: ${totalIssues}`);
    console.log(`   Deployment Ready: ${totalIssues === 0 ? 'YES' : 'NO'}`);
    
    return {
      grade,
      totalIssues,
      qwanScore: this.qwanScore,
      consciousnessLevel: this.consciousnessLevel
    };
  }

  calculateGrade(criticalIssues, qwanScore, consciousnessLevel) {
    let baseScore = 100;
    baseScore -= (criticalIssues * 15); // Critical issues heavily penalized
    baseScore += Math.min(qwanScore, 20); // QWAN bonus
    baseScore += Math.min(consciousnessLevel * 2, 10); // Consciousness bonus
    
    baseScore = Math.max(0, Math.min(100, baseScore));
    
    let letter = 'F';
    if (baseScore >= 95) letter = 'A+';
    else if (baseScore >= 90) letter = 'A';
    else if (baseScore >= 85) letter = 'A-';
    else if (baseScore >= 80) letter = 'B+';
    else if (baseScore >= 75) letter = 'B';
    else if (baseScore >= 70) letter = 'B-';
    else if (baseScore >= 65) letter = 'C+';
    else if (baseScore >= 60) letter = 'C';
    else if (baseScore >= 55) letter = 'C-';
    else if (baseScore >= 50) letter = 'D';
    
    return { score: Math.round(baseScore), letter };
  }
}

// Execute comprehensive audit
const auditor = new ComplianceAuditor();
auditor.runAudit();