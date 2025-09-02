use std::collections::HashMap;
use tracing::{info, warn, error};

pub struct GenerationTool {
    templates: HashMap<String, &'static str>,
}

impl GenerationTool {
    pub fn new() -> Self {
        let mut templates = HashMap::new();
        
        // Add common code generation templates
        templates.insert("function".to_string(), r#"
pub fn {name}({params}) -> {return_type} {{
    // TODO: Implement function logic
    {default_return}
}}
"#);
        
        templates.insert("struct".to_string(), r#"
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
"#);
        
        templates.insert("module".to_string(), r#"
//! {name} module
//! {description}

use std::collections::HashMap;
use tracing::{{info, warn, error}};

{content}
"#);
        
        templates.insert("test".to_string(), r#"
#[cfg(test)]
mod tests {{
    use super::*;
    
    #[test]
    fn test_{test_name}() {{
        // TODO: Implement test
        assert!(true);
    }}
}}
"#);
        
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
            _ => self.generate_generic_code(&context)
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
            if let Ok(regex) = regex::Regex::new(pattern) {
                if let Some(captures) = regex.captures(prompt) {
                    if let Some(name) = captures.get(1) {
                        return Some(name.as_str().to_string());
                    }
                }
            }
        }
        
        None
    }
    
    fn generate_function(&self, context: &HashMap<String, String>) -> Result<String, Box<dyn std::error::Error>> {
        let template = self.templates.get("function").unwrap();
        let name = context.get("name").unwrap_or(&"generated_function".to_string());
        let return_type = context.get("return_type").unwrap_or(&"()".to_string());
        let default_return = context.get("default_return").unwrap_or(&"()".to_string());
        
        let code = template
            .replace("{name}", name)
            .replace("{params}", "")  // TODO: Extract parameters from prompt
            .replace("{return_type}", return_type)
            .replace("{default_return}", default_return);
            
        Ok(code)
    }
    
    fn generate_struct(&self, context: &HashMap<String, String>) -> Result<String, Box<dyn std::error::Error>> {
        let template = self.templates.get("struct").unwrap();
        let name = context.get("name").unwrap_or(&"GeneratedStruct".to_string());
        
        let code = template
            .replace("{name}", name)
            .replace("{fields}", "    // TODO: Add fields")
            .replace("{constructor_params}", "")
            .replace("{field_assignments}", "        // TODO: Assign fields");
            
        Ok(code)
    }
    
    fn generate_module(&self, context: &HashMap<String, String>) -> Result<String, Box<dyn std::error::Error>> {
        let template = self.templates.get("module").unwrap();
        let name = context.get("name").unwrap_or(&"generated_module".to_string());
        let description = context.get("description").unwrap_or(&"Generated module".to_string());
        
        let code = template
            .replace("{name}", name)
            .replace("{description}", description)
            .replace("{content}", "// TODO: Add module content");
            
        Ok(code)
    }
    
    fn generate_test(&self, context: &HashMap<String, String>) -> Result<String, Box<dyn std::error::Error>> {
        let template = self.templates.get("test").unwrap();
        let name = context.get("name").unwrap_or(&"generated".to_string());
        
        let code = template
            .replace("{test_name}", name);
            
        Ok(code)
    }
    
    fn generate_api_handler(&self, context: &HashMap<String, String>) -> Result<String, Box<dyn std::error::Error>> {
        let name = context.get("name").unwrap_or(&"handler".to_string());
        
        let code = format!(r#"
use serde::{{Serialize, Deserialize}};

#[derive(Deserialize)]
pub struct {name}Request {{
    // TODO: Add request fields
}}

#[derive(Serialize)]
pub struct {name}Response {{
    // TODO: Add response fields
}}

pub async fn {name}(request: {name}Request) -> Result<{name}Response, Box<dyn std::error::Error>> {{
    // TODO: Implement handler logic
    Ok({name}Response {{}})
}}
"#, name = name);
        
        Ok(code)
    }
    
    fn generate_error_type(&self, context: &HashMap<String, String>) -> Result<String, Box<dyn std::error::Error>> {
        let name = context.get("name").unwrap_or(&"GeneratedError".to_string());
        
        let code = format!(r#"
use std::fmt;

#[derive(Debug, Clone)]
pub enum {name} {{
    // TODO: Add error variants
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
"#, name = name);
        
        Ok(code)
    }
    
    fn generate_generic_code(&self, context: &HashMap<String, String>) -> Result<String, Box<dyn std::error::Error>> {
        let description = context.get("description").unwrap_or(&"Generated code".to_string());
        let name = context.get("name").unwrap_or(&"generated_function".to_string());
        
        let code = format!(r#"
// Generated from prompt: {}
pub fn {}() -> Result<(), Box<dyn std::error::Error>> {{
    // TODO: Implement functionality
    tracing::info!("Executing generated function");
    Ok(())
}}
"#, description, name);
        
        Ok(code)
    }
}

impl Default for GenerationTool {
    fn default() -> Self {
        Self::new()
    }
}