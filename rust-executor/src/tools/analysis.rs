use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Mutex, time::Instant};
use tracing::{info, warn};
use tree_sitter::{Node, Parser, Query, QueryCursor};
use tree_sitter_rust::language as rust_language;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeAnalysisResult {
    pub metrics: CodeMetrics,
    pub issues: Vec<CodeIssue>,
    pub suggestions: Vec<String>,
    pub complexity_score: f64,
    pub maintainability_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CodeMetrics {
    pub total_lines: usize,
    pub code_lines: usize,
    pub comment_lines: usize,
    pub blank_lines: usize,
    pub functions: usize,
    pub classes_or_structs: usize,
    pub cyclomatic_complexity: usize,
    pub nesting_depth: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeIssue {
    pub issue_type: String,
    pub severity: String,
    pub line: Option<usize>,
    pub description: String,
    pub suggestion: Option<String>,
}

pub struct AnalysisTool {
    patterns: HashMap<String, Vec<&'static str>>,
    parser: Mutex<Parser>,
    query_fn: Query,
    query_struct: Query,
    query_complex: Query,
}

impl AnalysisTool {
    pub fn new() -> Self {
        let mut patterns = HashMap::new();

        // Security issues
        patterns.insert(
            "security".to_string(),
            vec![
                "eval(",
                "exec(",
                "system(",
                "shell_exec",
                "setTimeout.*[\"']",
                "innerHTML",
                "document.write",
                "unsafelySetInnerHTML",
            ],
        );

        // Performance issues
        patterns.insert(
            "performance".to_string(),
            vec![
                "document.getElementById",
                "querySelector.*in.*loop",
                "for.*in.*for",
                "while.*true.*break",
                "recursive.*without.*base",
                "O\\(n\\^2\\)",
            ],
        );

        // Code smells
        patterns.insert(
            "code_smell".to_string(),
            vec![
                "god_class",
                "long_method",
                "duplicate_code",
                "magic_number",
                "deep_nesting",
                "long_parameter_list",
            ],
        );

        // Best practices
        patterns.insert(
            "best_practice".to_string(),
            vec![
                "console.log",
                "alert(",
                "confirm(",
                "var ",
                "== ",
                "!= ",
                "catch.*empty",
                "TODO",
                "FIXME",
            ],
        );

        let mut parser = Parser::new();
        parser
            .set_language(rust_language())
            .expect("Error loading Rust grammar");
        let lang = rust_language();
        let query_fn = Query::new(lang, "(function_item) @fn").expect("Failed to compile fn query");
        let query_struct = Query::new(lang, "(struct_item) @s\n(enum_item) @e")
            .expect("Failed to compile struct query");
        let query_complex = Query::new(
            lang,
            "(if_expression) @c\n(match_expression) @c\n(for_expression) @c\n(while_expression) @c\n(loop_expression) @c",
        )
        .expect("Failed to compile complexity query");

        Self {
            patterns,
            parser: Mutex::new(parser),
            query_fn,
            query_struct,
            query_complex,
        }
    }

    pub async fn analyze_code(&self, code: &str) -> Result<String, Box<dyn std::error::Error>> {
        info!(
            "Starting code analysis for {} characters of code",
            code.len()
        );

        let analysis_result = self.perform_analysis(code).await?;
        let json_result = serde_json::to_string_pretty(&analysis_result)?;

        Ok(json_result)
    }

    async fn perform_analysis(
        &self,
        code: &str,
    ) -> Result<CodeAnalysisResult, Box<dyn std::error::Error>> {
        let metrics = self.calculate_metrics(code);
        let issues = self.detect_issues(code);
        let suggestions = self.generate_suggestions(&metrics, &issues);
        let complexity_score = self.calculate_complexity_score(&metrics, &issues);
        let maintainability_score = self.calculate_maintainability_score(&metrics, &issues);

        Ok(CodeAnalysisResult {
            metrics,
            issues,
            suggestions,
            complexity_score,
            maintainability_score,
        })
    }

    fn calculate_metrics(&self, code: &str) -> CodeMetrics {
        // Benchmark tree-sitter approach
        let start_ts = Instant::now();
        let ts_metrics = self.calculate_metrics_tree_sitter(code);
        let ts_time = start_ts.elapsed();

        // Benchmark legacy regex approach
        let start_regex = Instant::now();
        let regex_metrics = self.calculate_metrics_regex(code);
        let regex_time = start_regex.elapsed();

        info!(
            "metric collection times - tree-sitter: {:?}, regex: {:?}",
            ts_time, regex_time
        );

        match ts_metrics {
            Some(ts_metrics) => {
                if ts_metrics != regex_metrics {
                    warn!(
                        "metric discrepancy detected: tree-sitter {:?} vs regex {:?}",
                        ts_metrics, regex_metrics
                    );
                }
                ts_metrics
            }
            None => {
                warn!("tree-sitter parsing failed, falling back to regex metrics");
                regex_metrics
            }
        }
    }

    fn calculate_metrics_tree_sitter(&self, code: &str) -> Option<CodeMetrics> {
        let mut parser = self.parser.lock().ok()?;
        let tree = parser.parse(code, None)?;

        if tree.root_node().has_error() {
            return None;
        }

        let lines: Vec<&str> = code.lines().collect();
        let total_lines = lines.len();

        let mut code_lines = 0;
        let mut comment_lines = 0;
        let mut blank_lines = 0;
        for line in &lines {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                blank_lines += 1;
            } else if trimmed.starts_with("//")
                || trimmed.starts_with("/*")
                || trimmed.starts_with("*")
            {
                comment_lines += 1;
            } else {
                code_lines += 1;
            }
        }

        // Count functions
        let mut cursor = QueryCursor::new();
        let functions = cursor
            .matches(&self.query_fn, tree.root_node(), code.as_bytes())
            .count();

        // Count structs/enums
        let mut cursor = QueryCursor::new();
        let classes_or_structs = cursor
            .matches(&self.query_struct, tree.root_node(), code.as_bytes())
            .count();

        // Cyclomatic complexity via control flow nodes
        let mut cursor = QueryCursor::new();
        let cyclomatic_complexity = 1 + cursor
            .matches(&self.query_complex, tree.root_node(), code.as_bytes())
            .count();

        // Nesting depth by traversing block nodes
        fn max_depth(node: Node, depth: usize) -> usize {
            let mut max_d = depth;
            let mut child_cursor = node.walk();
            for child in node.children(&mut child_cursor) {
                let child_depth = if child.kind() == "block" {
                    max_depth(child, depth + 1)
                } else {
                    max_depth(child, depth)
                };
                max_d = max_d.max(child_depth);
            }
            max_d
        }
        let nesting_depth = max_depth(tree.root_node(), 0);

        Some(CodeMetrics {
            total_lines,
            code_lines,
            comment_lines,
            blank_lines,
            functions,
            classes_or_structs,
            cyclomatic_complexity,
            nesting_depth,
        })
    }

    fn calculate_metrics_regex(&self, code: &str) -> CodeMetrics {
        let lines: Vec<&str> = code.lines().collect();
        let total_lines = lines.len();

        let mut code_lines = 0;
        let mut comment_lines = 0;
        let mut blank_lines = 0;
        let mut max_nesting = 0;
        let mut current_nesting = 0;

        for line in &lines {
            let trimmed = line.trim();

            if trimmed.is_empty() {
                blank_lines += 1;
            } else if trimmed.starts_with("//")
                || trimmed.starts_with("/*")
                || trimmed.starts_with("*")
            {
                comment_lines += 1;
            } else {
                code_lines += 1;

                let open_braces = trimmed.matches('{').count();
                let close_braces = trimmed.matches('}').count();
                current_nesting += open_braces;
                max_nesting = max_nesting.max(current_nesting);
                current_nesting = current_nesting.saturating_sub(close_braces);
            }
        }

        let functions = self.count_functions_regex(code);
        let classes_or_structs = self.count_classes_structs_regex(code);
        let cyclomatic_complexity = self.calculate_cyclomatic_complexity_regex(code);

        CodeMetrics {
            total_lines,
            code_lines,
            comment_lines,
            blank_lines,
            functions,
            classes_or_structs,
            cyclomatic_complexity,
            nesting_depth: max_nesting,
        }
    }

    fn count_functions_regex(&self, code: &str) -> usize {
        let function_patterns = [
            r"fn\s+\w+",
            r"function\s+\w+",
            r"def\s+\w+",
            r"pub\s+fn\s+\w+",
            r"async\s+fn\s+\w+",
        ];

        let mut count = 0;
        for pattern in function_patterns.iter() {
            if let Ok(regex) = regex::Regex::new(pattern) {
                count += regex.find_iter(code).count();
            }
        }
        count
    }

    fn count_classes_structs_regex(&self, code: &str) -> usize {
        let class_patterns = [
            r"class\s+\w+",
            r"struct\s+\w+",
            r"enum\s+\w+",
            r"interface\s+\w+",
            r"type\s+\w+\s*=",
        ];

        let mut count = 0;
        for pattern in class_patterns.iter() {
            if let Ok(regex) = regex::Regex::new(pattern) {
                count += regex.find_iter(code).count();
            }
        }
        count
    }

    fn calculate_cyclomatic_complexity_regex(&self, code: &str) -> usize {
        let complexity_patterns = [
            r"\bif\b",
            r"\belse\b",
            r"\bfor\b",
            r"\bwhile\b",
            r"\bmatch\b",
            r"\bswitch\b",
            r"\btry\b",
            r"\bcatch\b",
            r"\?\?",
            r"\?\s*:",
        ];

        let mut complexity = 1; // Base complexity

        for pattern in complexity_patterns.iter() {
            if let Ok(regex) = regex::Regex::new(pattern) {
                complexity += regex.find_iter(code).count();
            }
        }

        complexity
    }

    fn detect_issues(&self, code: &str) -> Vec<CodeIssue> {
        let mut issues = Vec::new();
        let lines: Vec<&str> = code.lines().collect();

        // Check for security issues
        for (line_num, line) in lines.iter().enumerate() {
            for pattern in self.patterns.get("security").unwrap_or(&vec![]) {
                if line.contains(pattern) {
                    issues.push(CodeIssue {
                        issue_type: "Security".to_string(),
                        severity: "High".to_string(),
                        line: Some(line_num + 1),
                        description: format!("Potential security issue: {}", pattern),
                        suggestion: Some("Review for security implications".to_string()),
                    });
                }
            }

            // Check for best practice violations
            for pattern in self.patterns.get("best_practice").unwrap_or(&vec![]) {
                if line.contains(pattern) {
                    let severity = match *pattern {
                        "console.log" | "TODO" | "FIXME" => "Low",
                        "var " | "== " => "Medium",
                        _ => "Low",
                    };

                    issues.push(CodeIssue {
                        issue_type: "Best Practice".to_string(),
                        severity: severity.to_string(),
                        line: Some(line_num + 1),
                        description: format!("Best practice violation: {}", pattern),
                        suggestion: Some(self.get_suggestion_for_pattern(pattern)),
                    });
                }
            }

            // Check for performance issues
            if line.len() > 120 {
                issues.push(CodeIssue {
                    issue_type: "Style".to_string(),
                    severity: "Low".to_string(),
                    line: Some(line_num + 1),
                    description: "Line too long".to_string(),
                    suggestion: Some("Consider breaking into multiple lines".to_string()),
                });
            }
        }

        // Check for overall code structure issues
        if lines.len() > 500 {
            issues.push(CodeIssue {
                issue_type: "Structure".to_string(),
                severity: "Medium".to_string(),
                line: None,
                description: "File is very large".to_string(),
                suggestion: Some("Consider breaking into smaller modules".to_string()),
            });
        }

        issues
    }

    fn get_suggestion_for_pattern(&self, pattern: &str) -> String {
        match pattern {
            "console.log" => "Use proper logging instead of console.log".to_string(),
            "var " => "Use 'let' or 'const' instead of 'var'".to_string(),
            "== " => "Use '===' for strict equality".to_string(),
            "!= " => "Use '!==' for strict inequality".to_string(),
            "TODO" => "Resolve TODO comment".to_string(),
            "FIXME" => "Address FIXME comment".to_string(),
            _ => "Review and fix this issue".to_string(),
        }
    }

    fn generate_suggestions(&self, metrics: &CodeMetrics, issues: &Vec<CodeIssue>) -> Vec<String> {
        let mut suggestions = Vec::new();

        if metrics.cyclomatic_complexity > 10 {
            suggestions.push("Consider reducing complexity by breaking down functions".to_string());
        }

        if metrics.nesting_depth > 4 {
            suggestions.push("Reduce nesting depth for better readability".to_string());
        }

        if metrics.code_lines > 0
            && metrics.comment_lines as f64 / (metrics.code_lines as f64) < 0.1
        {
            suggestions.push("Add more comments to improve code documentation".to_string());
        }

        if issues.iter().any(|i| i.severity == "High") {
            suggestions.push("Address high-severity issues immediately".to_string());
        }

        if metrics.functions == 0 && metrics.code_lines > 20 {
            suggestions.push("Consider organizing code into functions".to_string());
        }

        suggestions
    }

    fn calculate_complexity_score(&self, metrics: &CodeMetrics, issues: &Vec<CodeIssue>) -> f64 {
        let mut score = 100.0;

        // Penalize high cyclomatic complexity
        if metrics.cyclomatic_complexity > 15 {
            score -= 30.0;
        } else if metrics.cyclomatic_complexity > 10 {
            score -= 15.0;
        }

        // Penalize deep nesting
        if metrics.nesting_depth > 5 {
            score -= 20.0;
        } else if metrics.nesting_depth > 3 {
            score -= 10.0;
        }

        // Penalize high-severity issues
        let high_severity_count = issues.iter().filter(|i| i.severity == "High").count();
        score -= high_severity_count as f64 * 15.0;

        score.max(0.0)
    }

    fn calculate_maintainability_score(
        &self,
        metrics: &CodeMetrics,
        issues: &Vec<CodeIssue>,
    ) -> f64 {
        let mut score = 100.0;

        // Factor in comment ratio
        let comment_ratio = if metrics.code_lines > 0 {
            metrics.comment_lines as f64 / metrics.code_lines as f64
        } else {
            0.0
        };

        if comment_ratio < 0.1 {
            score -= 20.0;
        } else if comment_ratio > 0.3 {
            score += 10.0;
        }

        // Factor in issues
        let medium_issues = issues.iter().filter(|i| i.severity == "Medium").count();
        let low_issues = issues.iter().filter(|i| i.severity == "Low").count();

        score -= medium_issues as f64 * 5.0;
        score -= low_issues as f64 * 2.0;

        // Factor in code organization
        if metrics.functions > 0 {
            let avg_lines_per_function = metrics.code_lines / metrics.functions;
            if avg_lines_per_function > 50 {
                score -= 15.0;
            }
        }

        score.max(0.0)
    }
}

impl Default for AnalysisTool {
    fn default() -> Self {
        Self::new()
    }
}
