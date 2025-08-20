#!/usr/bin/env node

/**
 * Autonomous Task Runner - Complete workflow demonstration
 * This script shows the intended workflow for CodeCrucible Synth
 */

import { autonomousTaskManager } from './dist/core/autonomous-task-manager.js';
import { taskMemoryDB } from './dist/core/task-memory-db.js';
import chalk from 'chalk';

async function runAutonomousTask() {
  console.log(chalk.blue('🚀 CodeCrucible Synth - Autonomous Task Execution'));
  console.log(chalk.gray('Demonstrating the complete workflow'));
  console.log('━'.repeat(60));

  try {
    // Initialize the task manager
    console.log(chalk.cyan('📋 Initializing task management system...'));
    await autonomousTaskManager.initialize();

    // Define the task
    const taskDescription = `
      Fix all critical issues in CodeCrucible Synth and validate core functionality:
      
      1. Fix Ollama context window (1024 → 8192) ✅ COMPLETED
      2. Standardize version numbers across all files  
      3. Fix EventEmitter memory leaks
      4. Fix failing unit tests (36 failures)
      5. Clean up emergency fix scripts
      6. Validate core codebase analysis functionality
      
      SUCCESS CRITERIA:
      - CLI responds with actual project analysis (not generic responses)
      - All tests pass
      - No memory leak warnings
      - Version consistency achieved
      - Clean, production-ready codebase
    `;

    // Plan and execute the task
    console.log(chalk.cyan('🎯 Planning and executing autonomous task...'));
    const task = await autonomousTaskManager.planAndExecuteTask(taskDescription);

    console.log(chalk.green(`✅ Task created: ${task.task_id}`));
    console.log(chalk.blue(`📊 Title: ${task.title}`));
    console.log(chalk.blue(`⚡ Priority: ${task.priority.toUpperCase()}`));
    console.log(chalk.blue(`🕒 Estimated Duration: ${task.estimated_duration || 'Calculating...'}`));

    // Monitor progress
    console.log('━'.repeat(60));
    console.log(chalk.yellow('📊 Task Progress Monitoring'));
    
    const progress = await taskMemoryDB.getTaskProgress(task.task_id);
    if (progress) {
      console.log(`Progress: ${progress.progress_percentage.toFixed(1)}%`);
      console.log(`Current Phase: ${progress.current_phase_progress.toFixed(1)}%`);
      console.log(`Next Steps:`);
      progress.next_steps.forEach(step => {
        console.log(chalk.gray(`  • ${step}`));
      });
    }

    console.log('━'.repeat(60));
    console.log(chalk.green('🎉 Autonomous task execution completed!'));
    console.log(chalk.gray('Check task.md for detailed progress and results'));

    // Show final status
    const finalTask = await taskMemoryDB.getTask(task.task_id);
    console.log(chalk.blue(`📋 Final Status: ${finalTask?.status.toUpperCase()}`));
    console.log(chalk.blue(`✅ Steps Completed: ${finalTask?.completed_steps.length || 0}`));
    console.log(chalk.blue(`❌ Failed Attempts: ${finalTask?.failed_attempts.length || 0}`));

    if (finalTask?.status === 'completed') {
      console.log(chalk.green('🏆 SUCCESS: All tasks completed successfully!'));
      console.log(chalk.gray('The system is now ready for production use.'));
    } else if (finalTask?.status === 'failed') {
      console.log(chalk.red('❌ FAILED: Some tasks could not be completed.'));
      console.log(chalk.gray('Check task.md and logs for details on what went wrong.'));
      console.log(chalk.gray('Run "git log --oneline" to see checkpoints for potential rollback.'));
    } else {
      console.log(chalk.yellow('⏳ IN PROGRESS: Task execution is ongoing...'));
      console.log(chalk.gray('Monitor task.md for real-time progress updates.'));
    }

  } catch (error) {
    console.error(chalk.red('❌ Autonomous task execution failed:'), error);
    console.log(chalk.yellow('🔄 System can be rolled back to last working state.'));
    process.exit(1);
  }
}

// Run the demonstration
runAutonomousTask().catch(console.error);