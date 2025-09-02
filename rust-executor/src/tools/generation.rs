use regex::Regex;
use std::collections::HashMap;
use tracing::{error, info, warn};

pub struct GenerationTool {
    templates: HashMap<String, &'static str>,
}

impl GenerationTool {
    pub fn new() -> Self {
        let mut templates = HashMap::new();

        // Add common code generation templates
        templates.insert(
            "function".to_string(),
            r#"
pub fn {name}({params}) -> {return_type} {{
    tracing::info!("Function {name} called");
    {default_return}
}}
"#,
        );

        templates.insert(
            "struct".to_string(),
            r#"
#[derive(Debug, Clone)]
pub struct {name} {{
    {fields}
}}

impl {name} {{
    pub fn new({constructor_params}) -> Self {{
        Self {{
            {field_assignments}
        }}
    }}
}}
"#,
        );

        templates.insert(
            "module".to_string(),
            r#"
//! {name} module
//! {description}

use std::collections::HashMap;
use tracing::{{info, warn, error}};

{content}
"#,
        );

        templates.insert(
            "test".to_string(),
            r#"
#[cfg(test)]
mod tests {{
    use super::*;
    
    #[test]
    fn test_{test_name}() {{
        assert!(true);
    }}
}}
"#,
        );

        Self { templates }
    }

    pub async fn generate_code(&self, prompt: &str) -> Result<String, Box<dyn std::error::Error>> {
        info!("Generating code from prompt: {}", prompt);

        // Parse the prompt to determine what to generate
        let generation_type = self.analyze_prompt(prompt);
        let context = self.extract_context(prompt);

        match generation_type.as_str() {
            "function" => self.generate_function(&context),
            "struct" => self.generate_struct(&context),
            "module" => self.generate_module(&context),
            "test" => self.generate_test(&context),
            "api" => self.generate_api_handler(&context),
            "error" => self.generate_error_type(&context),
            _ => self.generate_generic_code(&context),
        }
    }

    fn analyze_prompt(&self, prompt: &str) -> String {
        let prompt_lower = prompt.to_lowercase();

        if prompt_lower.contains("function") || prompt_lower.contains("fn ") {
            "function".to_string()
        } else if prompt_lower.contains("struct") || prompt_lower.contains("type") {
            "struct".to_string()
        } else if prompt_lower.contains("module") || prompt_lower.contains("mod ") {
            "module".to_string()
        } else if prompt_lower.contains("test") {
            "test".to_string()
        } else if prompt_lower.contains("api") || prompt_lower.contains("handler") {
            "api".to_string()
        } else if prompt_lower.contains("error") {
            "error".to_string()
        } else {
            "generic".to_string()
        }
    }

    fn extract_context(&self, prompt: &str) -> HashMap<String, String> {
        let mut context = HashMap::new();

        // Extract name
        if let Some(name) = self.extract_name(prompt) {
            context.insert("name".to_string(), name);
        } else {
            context.insert("name".to_string(), "GeneratedItem".to_string());
        }

        // Extract description
        context.insert("description".to_string(), prompt.to_string());

        // Extract return type hints
        if prompt.contains("->") || prompt.contains("returns") {
            if prompt.contains("String") || prompt.contains("str") {
                context.insert("return_type".to_string(), "String".to_string());
                context.insert("default_return".to_string(), "String::new()".to_string());
            } else if prompt.contains("bool") {
                context.insert("return_type".to_string(), "bool".to_string());
                context.insert("default_return".to_string(), "false".to_string());
            } else if prompt.contains("i32") || prompt.contains("number") {
                context.insert("return_type".to_string(), "i32".to_string());
                context.insert("default_return".to_string(), "0".to_string());
            } else {
                context.insert("return_type".to_string(), "()".to_string());
                context.insert("default_return".to_string(), "()".to_string());
            }
        } else {
            context.insert("return_type".to_string(), "()".to_string());
            context.insert("default_return".to_string(), "()".to_string());
        }

        // Extract parameters

        if let Some(params) = self.extract_parameters(prompt) {

        if let Some(params) = self.extract_params(prompt) {

            context.insert("params".to_string(), params);
        } else {
            context.insert("params".to_string(), String::new());
        }


        // Extract fields
        if let Some(fields) = self.extract_fields(prompt) {
            let fields_code = fields
                .iter()
                .map(|f| format!("    {},", f))
                .collect::<Vec<_>>()
                .join("\n");
            let constructor_params = fields.join(", ");
            let field_assignments = fields
                .iter()
                .enumerate()
                .map(|(i, f)| {
                    let name = f.split(':').next().unwrap().trim();
                    if i == 0 {
                        format!("{},", name)
                    } else {
                        format!("            {},", name)
                    }
                })
                .collect::<Vec<_>>()
                .join("\n");
            context.insert("fields".to_string(), fields_code);
            context.insert("constructor_params".to_string(), constructor_params);
            context.insert("field_assignments".to_string(), field_assignments);
        } else {
            context.insert("fields".to_string(), String::new());
            context.insert("constructor_params".to_string(), String::new());
            context.insert("field_assignments".to_string(), String::new());
        }

        // Extract module content
        if let Some(content) = self.extract_module_content(prompt) {
            context.insert("module_content".to_string(), content);
        } else {
            context.insert("module_content".to_string(), String::new());

        // Extract struct fields and constructor info
        if let Some(fields) = self.extract_fields(prompt) {
            let field_defs = fields
                .iter()
                .map(|(name, ty)| format!("pub {}: {}", name, ty))
                .collect::<Vec<_>>()
                .join(",\n    ");

            let constructor_params = fields
                .iter()
                .map(|(name, ty)| format!("{}: {}", name, ty))
                .collect::<Vec<_>>()
                .join(", ");

            let field_assignments = fields
                .iter()
                .map(|(name, _)| format!("{},", name))
                .collect::<Vec<_>>()
                .join("\n            ");

            context.insert("fields".to_string(), field_defs);
            context.insert("constructor_params".to_string(), constructor_params);
            context.insert("field_assignments".to_string(), field_assignments);
        } else {
            context.insert("fields".to_string(), "// TODO: Add fields".to_string());
            context.insert("constructor_params".to_string(), String::new());
            context.insert(
                "field_assignments".to_string(),
                "// TODO: Assign fields".to_string(),
            );

        }

        context
    }

    fn extract_name(&self, prompt: &str) -> Option<String> {
        // Simple name extraction patterns
        let patterns = [
            r"create (\w+)",
            r"generate (\w+)",
            r"fn (\w+)",
            r"struct (\w+)",
            r"function (\w+)",
        ];

        for pattern in patterns.iter() {
            if let Ok(regex) = Regex::new(pattern) {
                if let Some(captures) = regex.captures(prompt) {
                    if let Some(name) = captures.get(1) {
                        return Some(name.as_str().to_string());
                    }
                }
            }
        }

        None
    }


    fn extract_parameters(&self, prompt: &str) -> Option<String> {
        if let Ok(re) = Regex::new(r"params?:\s*([\w\s:,<>]+)") {
            if let Some(cap) = re.captures(prompt) {
                return Some(cap[1].trim().to_string());
            }
        }
        if let Ok(re) = Regex::new(r"fn\s+\w+\s*\(([^)]*)\)") {
            if let Some(cap) = re.captures(prompt) {
                return Some(cap[1].trim().to_string());
            }
        }
        None
    }

    fn extract_fields(&self, prompt: &str) -> Option<Vec<String>> {
        if let Ok(re) = Regex::new(r"fields?:\s*([\w\s:,<>]+)") {
            if let Some(cap) = re.captures(prompt) {
                let raw = cap[1].trim();
                let fields = raw
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>();
                if !fields.is_empty() {
                    return Some(fields);
                }
            }
        }
        None
    }

    fn extract_module_content(&self, prompt: &str) -> Option<String> {
        if let Ok(re) = Regex::new(r"(?s)content:\s*(.*)") {
            if let Some(cap) = re.captures(prompt) {
                return Some(cap[1].trim().to_string());
            }
        }
        None

    fn extract_params(&self, prompt: &str) -> Option<String> {
        // Look for explicit parameter list e.g., fn name(a: i32, b: String)
        if let Ok(regex) = regex::Regex::new(r"fn\s+\w+\s*\(([^)]*)\)") {
            if let Some(caps) = regex.captures(prompt) {
                return Some(caps.get(1).unwrap().as_str().trim().to_string());
            }
        }

        // Fallback: any "name: Type" pairs in the prompt
        let param_regex = regex::Regex::new(r"(\w+)\s*:\s*([A-Za-z0-9_<>]+)").ok()?;
        let params: Vec<String> = param_regex
            .captures_iter(prompt)
            .map(|c| format!("{}: {}", &c[1], &c[2]))
            .collect();
        if params.is_empty() {
            None
        } else {
            Some(params.join(", "))
        }
    }

    fn extract_fields(&self, prompt: &str) -> Option<Vec<(String, String)>> {
        let field_regex = regex::Regex::new(r"(\w+)\s*:\s*([A-Za-z0-9_<>]+)").ok()?;
        let fields: Vec<(String, String)> = field_regex
            .captures_iter(prompt)
            .map(|c| (c[1].to_string(), c[2].to_string()))
            .collect();
        if fields.is_empty() {
            None
        } else {
            Some(fields)
        }

    }

    fn generate_function(
        &self,
        context: &HashMap<String, String>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let template = self.templates.get("function").unwrap();
        let name = context
            .get("name")
            .cloned()
            .unwrap_or_else(|| "generated_function".to_string());
        let return_type = context
            .get("return_type")
            .cloned()
            .unwrap_or_else(|| "()".to_string());
        let default_return = context
            .get("default_return")
            .cloned()
            .unwrap_or_else(|| "()".to_string());
        let params = context.get("params").cloned().unwrap_or_default();

        let code = template
            .replace("{name}", &name)
            .replace("{params}", &params)
            .replace("{return_type}", &return_type)
            .replace("{default_return}", &default_return);

        Ok(code)
    }

    fn generate_struct(
        &self,
        context: &HashMap<String, String>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let template = self.templates.get("struct").unwrap();
        let name = context
            .get("name")
            .cloned()
            .unwrap_or_else(|| "GeneratedStruct".to_string());

        let fields = context.get("fields").cloned().unwrap_or_default();
=
        let fields = context
            .get("fields")
            .cloned()
            .unwrap_or_else(|| "// TODO: Add fields".to_string());

        let constructor_params = context
            .get("constructor_params")
            .cloned()
            .unwrap_or_default();
        let field_assignments = context
            .get("field_assignments")
            .cloned()

            .unwrap_or_default();

            .unwrap_or_else(|| "// TODO: Assign fields".to_string());


        let code = template
            .replace("{name}", &name)
            .replace("{fields}", &fields)
            .replace("{constructor_params}", &constructor_params)
            .replace("{field_assignments}", &field_assignments);

        Ok(code)
    }

    fn generate_module(
        &self,
        context: &HashMap<String, String>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let template = self.templates.get("module").unwrap();
        let name = context
            .get("name")
            .cloned()
            .unwrap_or_else(|| "generated_module".to_string());
        let description = context
            .get("description")
            .cloned()
            .unwrap_or_else(|| "Generated module".to_string());

        let content = context.get("module_content").cloned().unwrap_or_default();



        let code = template
            .replace("{name}", &name)
            .replace("{description}", &description)

            .replace("{content}", &content);

            .replace("{content}", "// TODO: Add module content");


        Ok(code)
    }

    fn generate_test(
        &self,
        context: &HashMap<String, String>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let template = self.templates.get("test").unwrap();
        let name = context
            .get("name")
            .cloned()
            .unwrap_or_else(|| "generated".to_string());

        let code = template.replace("{test_name}", &name);

        Ok(code)
    }

    fn generate_api_handler(
        &self,
        context: &HashMap<String, String>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let name = context
            .get("name")
            .cloned()
            .unwrap_or_else(|| "handler".to_string());

        let code = format!(
            r#"
use serde::{{Serialize, Deserialize}};

#[derive(Deserialize)]
pub struct {name}Request {{}}

#[derive(Serialize)]
pub struct {name}Response {{
    pub success: bool,
}}

pub async fn {name}(_request: {name}Request) -> Result<{name}Response, Box<dyn std::error::Error>> {{
    Ok({name}Response {{ success: true }})
}}
"#,
            name = name
        );

        Ok(code)
    }

    fn generate_error_type(
        &self,
        context: &HashMap<String, String>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let name = context
            .get("name")
            .cloned()
            .unwrap_or_else(|| "GeneratedError".to_string());

        let code = format!(
            r#"
use std::fmt;

#[derive(Debug, Clone)]
pub enum {name} {{
    Unknown(String),
}}

impl fmt::Display for {name} {{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {{
        match self {{
            {name}::Unknown(msg) => write!(f, "Unknown error: {{}}", msg),
        }}
    }}
}}

impl std::error::Error for {name} {{}}
"#,
            name = name
        );

        Ok(code)
    }

    fn generate_generic_code(
        &self,
        context: &HashMap<String, String>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let description = context
            .get("description")
            .cloned()
            .unwrap_or_else(|| "Generated code".to_string());
        let name = context
            .get("name")
            .cloned()
            .unwrap_or_else(|| "generated_function".to_string());

        let code = format!(
            r#"
// Generated from prompt: {}
pub fn {}() -> Result<(), Box<dyn std::error::Error>> {{
    tracing::info!("Executing generated function");
    Ok(())
}}
"#,
            description, name
        );

        Ok(code)
    }
}

impl Default for GenerationTool {
    fn default() -> Self {
        Self::new()
    }
}
