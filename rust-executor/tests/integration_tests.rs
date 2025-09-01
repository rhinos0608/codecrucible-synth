use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tempfile::TempDir;
use tokio::test;

use codecrucible_rust_executor::{
    benchmark_execution, create_rust_executor, get_version, init_logging, ExecutionOptions,
    RustExecutor, SecurityLevel,
};

// Import internal modules for comprehensive testing
use codecrucible_rust_executor::executors::{CommandExecutor, ExecutorFactory, FileSystemExecutor};
use codecrucible_rust_executor::protocol::{
    CommunicationHandler, ExecutionContext, ExecutionMessage, ExecutionRequest, MessagePayload,
    MessageType,
};
use codecrucible_rust_executor::security::{Capability, ResourceLimits, SecurityContext};
use codecrucible_rust_executor::utils::performance::{ExecutorBenchmarks, PerformanceTester};

/// Comprehensive integration test suite for the Rust executor
#[cfg(test)]
mod integration_tests {
    use super::*;

    /// Test complete NAPI integration end-to-end
    #[test]
    async fn test_complete_napi_integration() {
        init_logging(Some("debug".to_string())).expect("Failed to initialize logging");

        let mut executor = create_rust_executor().expect("Failed to create executor");

        // Test initialization
        let initialized = executor
            .initialize()
            .await
            .expect("Failed to initialize executor");
        assert!(initialized, "Executor should initialize successfully");

        // Test health check
        let health = executor.health_check().await.expect("Health check failed");
        let health_data: serde_json::Value =
            serde_json::from_str(&health).expect("Invalid health JSON");
        assert_eq!(health_data["status"], "healthy");
        assert!(!health_data["executor_id"].as_str().unwrap().is_empty());

        // Test supported tools
        let tools = executor
            .get_supported_tools()
            .expect("Failed to get supported tools");
        assert!(tools.contains(&"filesystem".to_string()));
        assert!(tools.contains(&"command".to_string()));

        // Test filesystem operations
        let fs_ops = executor
            .get_filesystem_operations()
            .expect("Failed to get filesystem operations");
        assert!(fs_ops.contains(&"read".to_string()));
        assert!(fs_ops.contains(&"write".to_string()));

        // Test command support
        let commands = executor
            .get_supported_commands()
            .expect("Failed to get supported commands");
        assert!(commands.contains(&"echo".to_string()));
        assert!(commands.contains(&"ls".to_string()));

        // Test performance metrics
        let metrics = executor
            .get_performance_metrics()
            .await
            .expect("Failed to get metrics");
        let metrics_data: serde_json::Value =
            serde_json::from_str(&metrics).expect("Invalid metrics JSON");
        assert_eq!(metrics_data["total_requests"], 0);

        // Test cleanup
        executor.cleanup().await.expect("Cleanup should succeed");
    }

    /// Test complete filesystem operations workflow
    #[test]
    async fn test_filesystem_integration_workflow() {
        let mut executor = create_rust_executor().expect("Failed to create executor");
        executor.initialize().await.expect("Failed to initialize");

        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let test_file = temp_dir.path().join("integration_test.txt");
        let test_content = "Integration test content\nMultiple lines\nFor comprehensive testing";

        let options = ExecutionOptions {
            session_id: Some("integration_test".to_string()),
            working_directory: Some(temp_dir.path().to_string_lossy().to_string()),
            timeout_ms: Some(10000),
            security_level: Some(SecurityLevel::Medium),
            capabilities: Some(vec!["file-read".to_string(), "file-write".to_string()]),
            environment: Some(HashMap::new()),
        };

        // Test write operation
        let write_result = executor
            .execute_filesystem(
                "write".to_string(),
                test_file.to_string_lossy().to_string(),
                Some(test_content.to_string()),
                Some(options.clone()),
            )
            .await
            .expect("Write operation failed");

        assert!(
            write_result.success,
            "Write should succeed: {:?}",
            write_result.error
        );
        assert!(write_result.execution_time_ms > 0);

        // Test read operation
        let read_result = executor
            .execute_filesystem(
                "read".to_string(),
                test_file.to_string_lossy().to_string(),
                None,
                Some(options.clone()),
            )
            .await
            .expect("Read operation failed");

        assert!(
            read_result.success,
            "Read should succeed: {:?}",
            read_result.error
        );

        let read_data: serde_json::Value =
            serde_json::from_str(&read_result.result.expect("Should have result"))
                .expect("Invalid result JSON");

        assert_eq!(read_data["content"], test_content);

        // Test file existence check
        let exists_result = executor
            .execute_filesystem(
                "exists".to_string(),
                test_file.to_string_lossy().to_string(),
                None,
                Some(options.clone()),
            )
            .await
            .expect("Exists operation failed");

        assert!(exists_result.success);

        let exists_data: serde_json::Value =
            serde_json::from_str(&exists_result.result.expect("Should have result"))
                .expect("Invalid exists JSON");

        assert_eq!(exists_data["content"], "true");

        // Test file info
        let info_result = executor
            .execute_filesystem(
                "get_info".to_string(),
                test_file.to_string_lossy().to_string(),
                None,
                Some(options.clone()),
            )
            .await
            .expect("Get info operation failed");

        assert!(info_result.success);

        let info_data: serde_json::Value =
            serde_json::from_str(&info_result.result.expect("Should have result"))
                .expect("Invalid info JSON");

        assert!(info_data["file_info"]["size"].as_u64().unwrap() > 0);
        assert_eq!(info_data["file_info"]["is_file"], true);

        // Test delete operation
        let delete_result = executor
            .execute_filesystem(
                "delete".to_string(),
                test_file.to_string_lossy().to_string(),
                None,
                Some(options),
            )
            .await
            .expect("Delete operation failed");

        assert!(
            delete_result.success,
            "Delete should succeed: {:?}",
            delete_result.error
        );

        // Verify file is deleted
        assert!(!test_file.exists());
    }

    /// Test command execution integration
    #[test]
    async fn test_command_execution_integration() {
        let mut executor = create_rust_executor().expect("Failed to create executor");
        executor.initialize().await.expect("Failed to initialize");

        let options = ExecutionOptions {
            session_id: Some("command_test".to_string()),
            working_directory: Some(std::env::temp_dir().to_string_lossy().to_string()),
            timeout_ms: Some(5000),
            security_level: Some(SecurityLevel::Medium),
            capabilities: Some(vec!["process-spawn".to_string()]),
            environment: Some(
                [("TEST_VAR".to_string(), "test_value".to_string())]
                    .iter()
                    .cloned()
                    .collect(),
            ),
        };

        // Test echo command
        let echo_result = executor
            .execute_command(
                "echo".to_string(),
                vec![
                    "Hello".to_string(),
                    "Integration".to_string(),
                    "Test".to_string(),
                ],
                Some(options.clone()),
            )
            .await
            .expect("Echo command failed");

        assert!(
            echo_result.success,
            "Echo should succeed: {:?}",
            echo_result.error
        );

        let echo_data: serde_json::Value =
            serde_json::from_str(&echo_result.result.expect("Should have result"))
                .expect("Invalid echo JSON");

        assert!(echo_data["stdout"]
            .as_str()
            .unwrap()
            .contains("Hello Integration Test"));

        // Test pwd command
        let pwd_result = executor
            .execute_command("pwd".to_string(), vec![], Some(options.clone()))
            .await
            .expect("Pwd command failed");

        assert!(
            pwd_result.success,
            "Pwd should succeed: {:?}",
            pwd_result.error
        );

        // Test performance metrics after commands
        let metrics = executor
            .get_performance_metrics()
            .await
            .expect("Failed to get metrics");
        let metrics_data: serde_json::Value =
            serde_json::from_str(&metrics).expect("Invalid metrics JSON");
        assert!(metrics_data["total_requests"].as_u64().unwrap() > 0);
    }

    /// Ensure long-running commands are terminated when exceeding timeout
    #[test]
    async fn test_command_timeout_terminates_process() {
        let mut executor = create_rust_executor().expect("Failed to create executor");
        executor.initialize().await.expect("Failed to initialize");

        // Ensure no lingering python processes from previous runs
        let pre_check = std::process::Command::new("pgrep")
            .arg("-f")
            .arg("time.sleep(5)")
            .output()
            .expect("pgrep failed");
        assert!(pre_check.stdout.is_empty());

        let options = ExecutionOptions {
            session_id: Some("timeout_test".to_string()),
            working_directory: Some(std::env::temp_dir().to_string_lossy().to_string()),
            timeout_ms: Some(100), // 100ms timeout
            security_level: Some(SecurityLevel::Medium),
            capabilities: Some(vec!["process-spawn".to_string()]),
            environment: Some(HashMap::new()),
        };

        let result = executor
            .execute_command(
                "python".to_string(),
                vec!["-c".to_string(), "import time; time.sleep(5)".to_string()],
                Some(options),
            )
            .await
            .expect("Command execution should complete");

        assert!(
            !result.success,
            "Command should fail due to timeout: {:?}",
            result.error
        );
        let err = result.error.expect("Should have error");
        assert_eq!(err.code, "COMMAND_TIMEOUT");

        // Verify the process was terminated
        let post_check = std::process::Command::new("pgrep")
            .arg("-f")
            .arg("time.sleep(5)")
            .output()
            .expect("pgrep failed");
        assert!(post_check.stdout.is_empty());
    }

    /// Test security system integration
    #[test]
    async fn test_security_system_integration() {
        let mut executor = create_rust_executor().expect("Failed to create executor");
        executor.initialize().await.expect("Failed to initialize");

        // Test with high security level
        let high_security_options = ExecutionOptions {
            session_id: Some("security_test".to_string()),
            working_directory: None,
            timeout_ms: Some(1000), // Very short timeout
            security_level: Some(SecurityLevel::High),
            capabilities: Some(vec!["file-read".to_string()]), // Limited capabilities
            environment: Some(HashMap::new()),
        };

        // Test restricted path access (should fail)
        let restricted_result = executor
            .execute_filesystem(
                "read".to_string(),
                "/etc/passwd".to_string(), // Restricted path
                None,
                Some(high_security_options.clone()),
            )
            .await
            .expect("Operation should complete");

        assert!(
            !restricted_result.success,
            "Should fail due to security restrictions"
        );
        assert!(restricted_result.error.is_some());

        // Test forbidden command (should fail)
        let forbidden_result = executor
            .execute_command(
                "rm".to_string(), // Not in whitelist
                vec!["-rf".to_string(), "/".to_string()],
                Some(high_security_options),
            )
            .await
            .expect("Operation should complete");

        assert!(
            !forbidden_result.success,
            "Should fail due to command restrictions"
        );
        assert!(forbidden_result.error.is_some());
    }

    /// Test performance benchmarking integration
    #[test]
    async fn test_performance_benchmarking_integration() {
        // Test built-in benchmark function
        let benchmark_result = benchmark_execution(10).await.expect("Benchmark failed");
        let benchmark_data: serde_json::Value =
            serde_json::from_str(&benchmark_result).expect("Invalid benchmark JSON");

        assert_eq!(benchmark_data["iterations"], 10);
        assert!(benchmark_data["total_time_ms"].as_u64().unwrap() > 0);
        assert!(benchmark_data["operations_per_second"].as_f64().unwrap() > 0.0);

        // Test comprehensive benchmarks
        let comprehensive = ExecutorBenchmarks::run_comprehensive_benchmark()
            .await
            .expect("Comprehensive benchmark failed");

        assert!(
            comprehensive["benchmark_summary"]["iterations"]
                .as_u64()
                .unwrap()
                > 0
        );
        assert!(
            comprehensive["filesystem_performance"]["operations_per_second"]
                .as_f64()
                .unwrap()
                > 0.0
        );
        assert!(
            comprehensive["command_performance"]["operations_per_second"]
                .as_f64()
                .unwrap()
                > 0.0
        );

        let fs_grade = comprehensive["filesystem_performance"]["performance_grade"]
            .as_str()
            .unwrap();
        let cmd_grade = comprehensive["command_performance"]["performance_grade"]
            .as_str()
            .unwrap();

        assert!([
            "Excellent",
            "Very Good",
            "Good",
            "Fair",
            "Needs Improvement"
        ]
        .contains(&fs_grade));
        assert!([
            "Excellent",
            "Very Good",
            "Good",
            "Fair",
            "Needs Improvement"
        ]
        .contains(&cmd_grade));
    }

    /// Test communication protocol integration
    #[test]
    async fn test_communication_protocol_integration() {
        let handler = CommunicationHandler::new();
        handler
            .initialize()
            .await
            .expect("Handler initialization failed");

        // Test message creation and serialization
        let test_request = ExecutionRequest {
            tool_id: "filesystem".to_string(),
            operation: "read".to_string(),
            arguments: [(
                "path".to_string(),
                serde_json::Value::String("/tmp/test".to_string()),
            )]
            .iter()
            .cloned()
            .collect(),
            context: ExecutionContext::default(),
            timeout_ms: Some(10000),
            stream_response: false,
        };

        let message = ExecutionMessage::new(
            MessageType::Request,
            MessagePayload::ExecutionRequest(test_request),
        );

        // Test NDJSON serialization
        let ndjson = message.to_ndjson().expect("NDJSON serialization failed");
        assert!(ndjson.ends_with('\n'));

        // Test deserialization
        let parsed = ExecutionMessage::from_ndjson(&ndjson).expect("NDJSON deserialization failed");
        assert_eq!(parsed.message_type, MessageType::Request);
        assert_eq!(parsed.id, message.id);
    }

    /// Test error handling integration
    #[test]
    async fn test_error_handling_integration() {
        let mut executor = create_rust_executor().expect("Failed to create executor");
        executor.initialize().await.expect("Failed to initialize");

        // Test uninitialized executor (create new one)
        let uninitialized = create_rust_executor().expect("Failed to create executor");
        // Don't initialize this one

        let result = uninitialized
            .execute_filesystem("read".to_string(), "/tmp/test".to_string(), None, None)
            .await
            .expect("Operation should complete");

        assert!(!result.success);
        assert!(result.error.as_ref().unwrap().contains("not initialized"));

        // Test invalid JSON arguments
        let invalid_args = "{invalid json".to_string();
        let result = executor
            .execute("filesystem".to_string(), invalid_args, None)
            .await
            .expect("Operation should complete");

        assert!(!result.success);
        assert!(result
            .error
            .as_ref()
            .unwrap()
            .contains("Invalid arguments JSON"));

        // Test nonexistent file
        let result = executor
            .execute_filesystem(
                "read".to_string(),
                "/nonexistent/file/path".to_string(),
                None,
                None,
            )
            .await
            .expect("Operation should complete");

        // This might succeed or fail depending on security context, but should not crash
        assert!(result.execution_time_ms > 0);
    }

    /// Test concurrent operations integration
    #[test]
    async fn test_concurrent_operations_integration() {
        let mut executor = Arc::new(create_rust_executor().expect("Failed to create executor"));
        Arc::get_mut(&mut executor)
            .unwrap()
            .initialize()
            .await
            .expect("Failed to initialize");

        let temp_dir = TempDir::new().expect("Failed to create temp dir");

        // Spawn multiple concurrent filesystem operations
        let mut handles = vec![];

        for i in 0..5 {
            let executor_clone = executor.clone();
            let temp_path = temp_dir.path().join(format!("concurrent_test_{}.txt", i));

            let handle = tokio::spawn(async move {
                let content = format!("Concurrent test content {}", i);

                // Write file
                let write_result = executor_clone
                    .execute_filesystem(
                        "write".to_string(),
                        temp_path.to_string_lossy().to_string(),
                        Some(content.clone()),
                        None,
                    )
                    .await
                    .expect("Write operation failed");

                assert!(write_result.success, "Write {} should succeed", i);

                // Read it back
                let read_result = executor_clone
                    .execute_filesystem(
                        "read".to_string(),
                        temp_path.to_string_lossy().to_string(),
                        None,
                        None,
                    )
                    .await
                    .expect("Read operation failed");

                assert!(read_result.success, "Read {} should succeed", i);

                let read_data: serde_json::Value =
                    serde_json::from_str(&read_result.result.expect("Should have result"))
                        .expect("Invalid result JSON");

                assert_eq!(read_data["content"], content);

                i
            });

            handles.push(handle);
        }

        // Wait for all operations to complete
        let results = futures::future::join_all(handles).await;

        for (i, result) in results.into_iter().enumerate() {
            let returned_i = result.expect("Task should complete successfully");
            assert_eq!(returned_i, i);
        }

        // Verify metrics reflect all operations
        let metrics = executor
            .get_performance_metrics()
            .await
            .expect("Failed to get metrics");
        let metrics_data: serde_json::Value =
            serde_json::from_str(&metrics).expect("Invalid metrics JSON");
        assert!(metrics_data["total_requests"].as_u64().unwrap() >= 10); // At least 10 requests (5 write + 5 read)
    }

    /// Test version and metadata integration
    #[test]
    fn test_version_and_metadata_integration() {
        let version = get_version();
        assert!(!version.is_empty());
        assert!(version.contains('.'));

        let executor = create_rust_executor().expect("Failed to create executor");
        let id = executor.get_id();
        assert!(!id.is_empty());
        assert_eq!(id.len(), 36); // UUID length
    }

    /// Test memory and resource management
    #[test]
    async fn test_resource_management_integration() {
        let mut executor = create_rust_executor().expect("Failed to create executor");
        executor.initialize().await.expect("Failed to initialize");

        // Reset metrics
        executor
            .reset_performance_metrics()
            .await
            .expect("Reset should succeed");

        let initial_metrics = executor
            .get_performance_metrics()
            .await
            .expect("Failed to get metrics");
        let initial_data: serde_json::Value =
            serde_json::from_str(&initial_metrics).expect("Invalid JSON");
        assert_eq!(initial_data["total_requests"], 0);

        // Perform some operations
        for i in 0..3 {
            let _ = executor
                .execute_filesystem("exists".to_string(), format!("/tmp/test_{}", i), None, None)
                .await;
        }

        // Check metrics updated
        let final_metrics = executor
            .get_performance_metrics()
            .await
            .expect("Failed to get metrics");
        let final_data: serde_json::Value =
            serde_json::from_str(&final_metrics).expect("Invalid JSON");
        assert_eq!(final_data["total_requests"], 3);

        // Test cleanup
        executor.cleanup().await.expect("Cleanup should succeed");
    }
}

/// Test utilities for integration testing
#[cfg(test)]
mod test_utils {
    use super::*;

    /// Create a temporary file with test content
    pub fn create_test_file(content: &str) -> (TempDir, PathBuf) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let file_path = temp_dir.path().join("test_file.txt");
        std::fs::write(&file_path, content).expect("Failed to write test file");
        (temp_dir, file_path)
    }

    /// Validate execution result structure
    pub fn validate_execution_result(result: &codecrucible_rust_executor::ExecutionResult) {
        assert!(
            result.execution_time_ms > 0,
            "Execution time should be positive"
        );

        if result.success {
            assert!(
                result.result.is_some(),
                "Successful operations should have results"
            );
            assert!(
                result.error.is_none(),
                "Successful operations should not have errors"
            );
        } else {
            assert!(
                result.error.is_some(),
                "Failed operations should have error messages"
            );
        }
    }

    /// Validate performance metrics structure
    pub fn validate_performance_metrics(metrics_json: &str) {
        let metrics: serde_json::Value =
            serde_json::from_str(metrics_json).expect("Metrics should be valid JSON");

        assert!(metrics["total_requests"].is_number());
        assert!(metrics["successful_requests"].is_number());
        assert!(metrics["failed_requests"].is_number());
        assert!(metrics["average_execution_time_ms"].is_number());
        assert!(metrics["total_execution_time_ms"].is_number());

        let total = metrics["total_requests"].as_u64().unwrap();
        let successful = metrics["successful_requests"].as_u64().unwrap();
        let failed = metrics["failed_requests"].as_u64().unwrap();

        assert_eq!(
            total,
            successful + failed,
            "Total should equal successful + failed"
        );
    }
}
