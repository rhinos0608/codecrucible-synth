pub struct NDJSONHandler;

impl NDJSONHandler {
    pub fn new() -> Self {
        Self
    }
    
    pub fn serialize(&self, data: &serde_json::Value) -> Result<String, Box<dyn std::error::Error>> {
        Ok(serde_json::to_string(data)?)
    }
    
    pub fn deserialize(&self, data: &str) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        Ok(serde_json::from_str(data)?)
    }
}

impl Default for NDJSONHandler {
    fn default() -> Self {
        Self::new()
    }
}