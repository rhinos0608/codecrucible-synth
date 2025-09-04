use regex::Regex;
use std::collections::HashSet;
use std::path::Path;

pub struct SecurityValidator {
    dangerous_patterns: Vec<Regex>,
    dangerous_commands: HashSet<&'static str>,
    max_input_length: usize,
}

impl SecurityValidator {
    pub fn new() -> Self {
        let dangerous_patterns = vec![
            // Command injection patterns
            Regex::new(r"[;&|`$(){}<>]").expect("Invalid regex for command injection"),
            Regex::new(r"\\x[0-9a-fA-F]{2}").expect("Invalid regex for hex encoding"),
            Regex::new(r"eval\s*\(").expect("Invalid regex for eval detection"),
            
            // Path traversal patterns
            Regex::new(r"\.\.[\\/]").expect("Invalid regex for path traversal"),
            Regex::new(r"[\\/]\.\.[\\/]").expect("Invalid regex for path traversal"),
            
            // SQL injection patterns
            Regex::new(r"(?i)(union|select|insert|update|delete|drop|create|alter)\s").expect("Invalid regex for SQL injection"),
            Regex::new(r"(?i)(or|and)\s+\d+\s*=\s*\d+").expect("Invalid regex for SQL injection"),
            
            // Script injection patterns
            Regex::new(r"<script[^>]*>").expect("Invalid regex for script injection"),
            Regex::new(r"javascript:").expect("Invalid regex for javascript protocol"),
            
            // Binary/executable patterns
            Regex::new(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]").expect("Invalid regex for control characters"),
        ];

        let dangerous_commands = [
            // System administration
            "sudo", "su", "passwd", "chown", "chmod", "chgrp",
            // File operations
            "rm", "rmdir", "del", "erase", "format", "fdisk",
            // Network operations
            "wget", "curl", "nc", "netcat", "telnet", "ssh", "ftp",
            // Process management
            "kill", "killall", "pkill", "ps", "top", "htop",
            // System information
            "cat", "type", "more", "less", "head", "tail",
            // Archive operations
            "tar", "zip", "unzip", "gzip", "gunzip",
            // Package managers
            "apt", "yum", "dnf", "pacman", "brew", "choco",
        ].iter().cloned().collect();

        Self {
            dangerous_patterns,
            dangerous_commands,
            max_input_length: 10000, // 10KB max input
        }
    }
    
    pub fn validate_input(&self, input: &str) -> Result<bool, Box<dyn std::error::Error>> {
        // Check input length
        if input.len() > self.max_input_length {
            return Ok(false);
        }

        // Check for null bytes and other dangerous characters
        if input.contains('\0') {
            return Ok(false);
        }

        // Check against dangerous patterns
        for pattern in &self.dangerous_patterns {
            if pattern.is_match(input) {
                return Ok(false);
            }
        }

        // Check for dangerous commands (case-insensitive)
        let input_lower = input.to_lowercase();
        for &cmd in &self.dangerous_commands {
            if input_lower.contains(cmd) {
                // Additional check: ensure it's a standalone command, not part of another word
                let cmd_regex = Regex::new(&format!(r"\b{}\b", regex::escape(cmd)))?;
                if cmd_regex.is_match(&input_lower) {
                    return Ok(false);
                }
            }
        }

        Ok(true)
    }

    pub fn validate_path(&self, path: &str) -> Result<bool, Box<dyn std::error::Error>> {
        // Basic path validation
        if path.is_empty() || path.len() > 4096 {
            return Ok(false);
        }

        // Check for path traversal
        if path.contains("../") || path.contains("..\\") || path.contains("..") {
            return Ok(false);
        }

        // Check for absolute paths to sensitive directories
        let sensitive_dirs = ["/etc", "/sys", "/proc", "/dev", "/boot", "/root"];
        for &dir in &sensitive_dirs {
            if path.starts_with(dir) {
                return Ok(false);
            }
        }

        // Windows sensitive paths
        let win_sensitive = ["C:\\Windows", "C:\\Program Files", "C:\\System"];
        for &dir in &win_sensitive {
            if path.to_lowercase().starts_with(&dir.to_lowercase()) {
                return Ok(false);
            }
        }

        // Validate path components
        let path_obj = Path::new(path);
        for component in path_obj.components() {
            if let Some(name) = component.as_os_str().to_str() {
                if name.starts_with('.') && name != "." && name != ".." {
                    continue; // Allow hidden files/dirs
                }
                if !self.validate_input(name)? {
                    return Ok(false);
                }
            }
        }

        Ok(true)
    }

    pub fn sanitize_input(&self, input: &str) -> String {
        // Remove null bytes and control characters
        let mut sanitized = input.replace('\0', "")
            .chars()
            .filter(|&c| c >= ' ' || c == '\n' || c == '\r' || c == '\t')
            .collect::<String>();

        // Limit length
        if sanitized.len() > self.max_input_length {
            sanitized.truncate(self.max_input_length);
        }

        // Escape shell metacharacters
        sanitized = sanitized
            .replace('\\', "\\\\")
            .replace('\'', "\\'")
            .replace('"', "\\\"")
            .replace('`', "\\`")
            .replace('$', "\\$");

        sanitized
    }
}

impl Default for SecurityValidator {
    fn default() -> Self {
        Self::new()
    }
}