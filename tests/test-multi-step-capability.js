#!/usr/bin/env node

/**
 * Multi-Step Problem Solving Validation Test
 * Agent 2: Testing CodeCrucible's ability to decompose and execute complex tasks
 */

import { spawn } from 'child_process';
import fs from 'fs';

console.log('🧪 AGENT 2: Multi-Step Problem Solving Validation Test');
console.log('=' .repeat(70));

const testScenarios = [
    {
        name: 'Complex Codebase Analysis',
        description: 'Analyze this codebase and suggest 3 improvements with implementation steps',
        command: 'node dist/index.js "Please analyze the CodeCrucible codebase and suggest 3 specific improvements. For each improvement, provide: 1) What needs to be changed, 2) Why it\'s important, 3) Specific implementation steps, 4) Expected impact. Focus on architecture, performance, or code quality."'
    },
    {
        name: 'Multi-File Refactoring Task',
        description: 'Complex refactoring requiring coordination across multiple files',
        command: 'node dist/index.js "I need to refactor the CLI system to improve startup time. Please: 1) Analyze the current CLI implementation, 2) Identify performance bottlenecks, 3) Create a detailed refactoring plan, 4) Show how to implement lazy loading, 5) Provide before/after performance estimates."'
    },
    {
        name: 'Living Spiral Methodology Test',
        description: 'Test the 5-phase Living Spiral process with a real problem',
        command: 'node dist/index.js "Using the Living Spiral methodology, help me design a new feature: Real-time collaboration for multiple developers working on the same codebase. Go through all 5 phases: Collapse, Council, Synthesis, Rebirth, and Reflection."'
    }
];

let testResults = [];

async function runTest(scenario, index) {
    console.log(`\n🔬 Test ${index + 1}: ${scenario.name}`);
    console.log(`Description: ${scenario.description}`);
    console.log('Command:', scenario.command);
    console.log('-'.repeat(50));
    
    const startTime = Date.now();
    
    return new Promise((resolve) => {
        const child = spawn('node', scenario.command.split(' ').slice(1), {
            stdio: ['inherit', 'pipe', 'pipe'],
            shell: true,
            cwd: process.cwd()
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout?.on('data', (data) => {
            stdout += data.toString();
            process.stdout.write(data); // Show output in real-time
        });
        
        child.stderr?.on('data', (data) => {
            stderr += data.toString();
            process.stderr.write(data);
        });
        
        child.on('close', (code) => {
            const duration = Date.now() - startTime;
            const success = code === 0 && stdout.length > 100;
            
            const result = {
                scenario: scenario.name,
                success,
                duration,
                code,
                outputLength: stdout.length,
                hasMultipleSteps: analyzeStepsInOutput(stdout),
                hasContextMaintenance: analyzeContextMaintenance(stdout),
                hasImplementationDetails: analyzeImplementationDetails(stdout),
                qualityScore: calculateQualityScore(stdout)
            };
            
            testResults.push(result);
            
            console.log('\n📊 Test Result:');
            console.log(`  Success: ${success ? '✅' : '❌'}`);
            console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
            console.log(`  Output Length: ${stdout.length} chars`);
            console.log(`  Multi-Step: ${result.hasMultipleSteps ? '✅' : '❌'}`);
            console.log(`  Context Maintenance: ${result.hasContextMaintenance ? '✅' : '❌'}`);
            console.log(`  Implementation Details: ${result.hasImplementationDetails ? '✅' : '❌'}`);
            console.log(`  Quality Score: ${result.qualityScore.toFixed(1)}/10`);
            
            if (stderr) {
                console.log(`  Errors: ${stderr.length > 0 ? '⚠️' : '✅'}`);
            }
            
            resolve(result);
        });
        
        // Timeout after 5 minutes
        setTimeout(() => {
            child.kill();
            console.log('\n⏰ Test timed out after 5 minutes');
            resolve({
                scenario: scenario.name,
                success: false,
                duration: 300000,
                code: -1,
                outputLength: stdout.length,
                hasMultipleSteps: false,
                hasContextMaintenance: false,
                hasImplementationDetails: false,
                qualityScore: 0,
                timeout: true
            });
        }, 300000);
    });
}

function analyzeStepsInOutput(output) {
    // Look for numbered steps, bullet points, phases
    const stepPatterns = [
        /\d+\.\s/g,          // 1. 2. 3.
        /step \d+/gi,        // Step 1, Step 2
        /phase \d+/gi,       // Phase 1, Phase 2
        /^\s*[-*]\s/gm,      // Bullet points
        /first|second|third|finally/gi  // Sequential words
    ];
    
    return stepPatterns.some(pattern => (output.match(pattern) || []).length >= 3);
}

function analyzeContextMaintenance(output) {
    // Look for references to previous steps, building on previous analysis
    const contextPatterns = [
        /based on|building on|following from/gi,
        /as mentioned|as discussed|from the above/gi,
        /previous|earlier|before|after/gi,
        /this leads to|therefore|consequently/gi
    ];
    
    return contextPatterns.some(pattern => (output.match(pattern) || []).length >= 2);
}

function analyzeImplementationDetails(output) {
    // Look for code examples, file names, specific technical details
    const implementationPatterns = [
        /```/g,              // Code blocks
        /\.js|\.ts|\.json/gi, // File extensions
        /function|class|import|export/gi, // Code keywords
        /src\/|config\/|tests\//gi,       // Directory paths
        /npm|git|node/gi     // Tool references
    ];
    
    return implementationPatterns.some(pattern => (output.match(pattern) || []).length >= 2);
}

function calculateQualityScore(output) {
    let score = 0;
    
    // Length and structure (0-3 points)
    if (output.length > 500) score += 1;
    if (output.length > 1500) score += 1;
    if (output.match(/#{1,3}|\d+\./g)?.length >= 3) score += 1;
    
    // Multi-step analysis (0-2 points)
    if (analyzeStepsInOutput(output)) score += 2;
    
    // Context maintenance (0-2 points)
    if (analyzeContextMaintenance(output)) score += 2;
    
    // Implementation details (0-2 points)
    if (analyzeImplementationDetails(output)) score += 2;
    
    // Completeness indicators (0-1 point)
    if (output.includes('conclusion') || output.includes('summary') || output.includes('next steps')) score += 1;
    
    return score;
}

async function runAllTests() {
    console.log('🚀 Starting Multi-Step Problem Solving Validation');
    console.log(`Testing ${testScenarios.length} scenarios...`);
    
    // Ensure dist directory exists
    if (!fs.existsSync('dist')) {
        console.log('❌ dist directory not found. Building project...');
        try {
            const { execSync } = await import('child_process');
            execSync('npm run build', { stdio: 'inherit' });
        } catch (error) {
            console.log('❌ Build failed:', error.message);
            process.exit(1);
        }
    }
    
    for (let i = 0; i < testScenarios.length; i++) {
        await runTest(testScenarios[i], i);
    }
    
    // Generate final report
    generateReport();
}

function generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📋 FINAL MULTI-STEP PROBLEM SOLVING VALIDATION REPORT');
    console.log('='.repeat(70));
    
    const successCount = testResults.filter(r => r.success).length;
    const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);
    const avgQuality = testResults.reduce((sum, r) => sum + r.qualityScore, 0) / testResults.length;
    
    console.log('\n📊 SUMMARY:');
    console.log(`  Tests Passed: ${successCount}/${testResults.length} (${((successCount/testResults.length)*100).toFixed(1)}%)`);
    console.log(`  Total Duration: ${(totalDuration/1000).toFixed(1)}s`);
    console.log(`  Average Quality Score: ${avgQuality.toFixed(1)}/10`);
    
    console.log('\n🔍 DETAILED RESULTS:');
    testResults.forEach((result, index) => {
        console.log(`\n  ${index + 1}. ${result.scenario}:`);
        console.log(`     Success: ${result.success ? '✅' : '❌'}`);
        console.log(`     Duration: ${(result.duration/1000).toFixed(1)}s`);
        console.log(`     Multi-Step Analysis: ${result.hasMultipleSteps ? '✅' : '❌'}`);
        console.log(`     Context Maintenance: ${result.hasContextMaintenance ? '✅' : '❌'}`);
        console.log(`     Implementation Details: ${result.hasImplementationDetails ? '✅' : '❌'}`);
        console.log(`     Quality Score: ${result.qualityScore.toFixed(1)}/10`);
        
        if (result.timeout) {
            console.log(`     Status: ⏰ TIMEOUT`);
        }
    });
    
    console.log('\n🎯 CAPABILITY ASSESSMENT:');
    const hasMultiStep = testResults.filter(r => r.hasMultipleSteps).length;
    const hasContext = testResults.filter(r => r.hasContextMaintenance).length;
    const hasImplementation = testResults.filter(r => r.hasImplementationDetails).length;
    
    console.log(`  Multi-Step Decomposition: ${hasMultiStep}/${testResults.length} tests (${((hasMultiStep/testResults.length)*100).toFixed(1)}%)`);
    console.log(`  Context Maintenance: ${hasContext}/${testResults.length} tests (${((hasContext/testResults.length)*100).toFixed(1)}%)`);
    console.log(`  Implementation Details: ${hasImplementation}/${testResults.length} tests (${((hasImplementation/testResults.length)*100).toFixed(1)}%)`);
    
    const overallScore = (successCount + hasMultiStep + hasContext + hasImplementation) / (testResults.length * 4) * 100;
    console.log(`  Overall Multi-Step Capability: ${overallScore.toFixed(1)}%`);
    
    if (overallScore >= 75) {
        console.log('\n🎉 EXCELLENT: CodeCrucible demonstrates strong multi-step problem solving capabilities');
    } else if (overallScore >= 50) {
        console.log('\n👍 GOOD: CodeCrucible shows decent multi-step capabilities with room for improvement');
    } else {
        console.log('\n⚠️ NEEDS IMPROVEMENT: Multi-step problem solving capabilities require enhancement');
    }
    
    // Save detailed results to file
    const reportPath = 'multi-step-validation-report.json';
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: {
            successRate: (successCount/testResults.length)*100,
            totalDuration: totalDuration,
            avgQuality: avgQuality,
            overallScore: overallScore
        },
        capabilities: {
            multiStepDecomposition: (hasMultiStep/testResults.length)*100,
            contextMaintenance: (hasContext/testResults.length)*100,
            implementationDetails: (hasImplementation/testResults.length)*100
        },
        detailedResults: testResults
    }, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

// Run the tests
runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
});