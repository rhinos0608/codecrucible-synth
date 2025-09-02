use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::time::Duration;
use serde::{Deserialize, Serialize};
use tokio::time::timeout;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionRequest {
    pub id: String,
    pub command: String,
    pub args: HashMap<String, serde_json::Value>,
    pub context: ExecutionContext,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionContext {
    pub session_id: String,
    pub working_directory: String,
    pub environment: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub id: String,
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

pub struct RustExecutorCore {
    id: String,
}

impl RustExecutorCore {
    pub fn new() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
        }
    }
    
    pub async fn execute(&self, request: ExecutionRequest) -> Result<ExecutionResult, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        
        // Parse command and arguments
        let mut cmd_parts = request.command.split_whitespace();
        let command = cmd_parts.next().ok_or("Empty command")?;
        let mut cmd_args: Vec<&str> = cmd_parts.collect();
        
        // Add any additional arguments from the args HashMap
        let mut additional_args = Vec::new();
        for (key, value) in &request.args {
            if key != "timeout_ms" && key != "capture_output" {
                if let Some(str_value) = value.as_str() {
                    additional_args.push(format!("--{}", key));
                    additional_args.push(str_value.to_string());
                }
            }
        }
        
        // Combine command args
        for arg in &additional_args {
            cmd_args.push(arg);
        }
        
        // Set up timeout (default 30 seconds)
        let timeout_duration = request.args.get("timeout_ms")
            .and_then(|v| v.as_u64())
            .map(Duration::from_millis)
            .unwrap_or(Duration::from_secs(30));
        
        // Execute command with timeout
        let execution_result = timeout(timeout_duration, async {
            let mut child = tokio::process::Command::new(command)
                .args(&cmd_args)
                .current_dir(&request.context.working_directory)
                .envs(&request.context.environment)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()?;
            
            let output = child.wait_with_output().await?;
            
            Ok::<tokio::process::Output, std::io::Error>(output)
        }).await;
        
        let execution_time_ms = start_time.elapsed().as_millis() as u64;
        
        match execution_result {
            Ok(Ok(output)) => {
                let success = output.status.success();
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                
                let result = ExecutionResult {
                    id: request.id,
                    success,
                    output: if success { stdout } else { stderr.clone() },
                    error: if success { None } else { Some(stderr) },
                    execution_time_ms,
                };
                
                Ok(result)
            }
            Ok(Err(io_error)) => {
                Ok(ExecutionResult {
                    id: request.id,
                    success: false,
                    output: String::new(),
                    error: Some(format!("IO Error: {}", io_error)),
                    execution_time_ms,
                })
            }
            Err(_timeout_error) => {
                Ok(ExecutionResult {
                    id: request.id,
                    success: false,
                    output: String::new(),
                    error: Some(format!("Command timed out after {}ms", timeout_duration.as_millis())),
                    execution_time_ms,
                })
            }
        }
    }
}