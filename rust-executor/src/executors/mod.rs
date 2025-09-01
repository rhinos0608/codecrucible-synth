pub mod filesystem;
pub mod command;

// Re-export the main executor types for easier access
pub use filesystem::{FileSystemExecutor, FileSystemError, FileOperation, FileOperationType, FileInfo, FileSystemResult};
pub use command::{CommandExecutor, CommandExecutionError, CommandRequest, CommandResult};

/// Executor registry for managing different types of executors
use std::sync::Arc;
use crate::security::SecurityContext;

pub struct ExecutorFactory;

impl ExecutorFactory {
    /// Create a new file system executor with the given security context
    pub fn create_filesystem_executor(security_context: SecurityContext) -> Arc<FileSystemExecutor> {
        Arc::new(FileSystemExecutor::new(security_context))
    }

    /// Create a new command executor with the given security context
    pub fn create_command_executor(security_context: SecurityContext) -> Arc<CommandExecutor> {
        Arc::new(CommandExecutor::new(security_context))
    }

    /// Create executors with default security contexts
    pub fn create_default_executors() -> (Arc<FileSystemExecutor>, Arc<CommandExecutor>) {
        let fs_context = SecurityContext::for_file_operations(&std::env::temp_dir());
        let cmd_context = SecurityContext::for_command_execution();
        
        (
            Self::create_filesystem_executor(fs_context),
            Self::create_command_executor(cmd_context),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_executor_factory() {
        let (fs_executor, cmd_executor) = ExecutorFactory::create_default_executors();
        
        assert!(Arc::strong_count(&fs_executor) == 1);
        assert!(Arc::strong_count(&cmd_executor) == 1);
    }

    #[test]
    fn test_individual_executor_creation() {
        let context = SecurityContext::default();
        let fs_executor = ExecutorFactory::create_filesystem_executor(context.clone());
        let cmd_executor = ExecutorFactory::create_command_executor(context);
        
        assert!(Arc::strong_count(&fs_executor) == 1);
        assert!(Arc::strong_count(&cmd_executor) == 1);
    }
}