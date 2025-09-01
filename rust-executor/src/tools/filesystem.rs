pub struct FileSystemTool;

impl FileSystemTool {
    pub fn new() -> Self {
        Self
    }
    
    pub async fn read_file(&self, path: &str) -> Result<String, Box<dyn std::error::Error>> {
        tokio::fs::read_to_string(path).await.map_err(Into::into)
    }
    
    pub async fn write_file(&self, path: &str, content: &str) -> Result<(), Box<dyn std::error::Error>> {
        tokio::fs::write(path, content).await.map_err(Into::into)
    }
}

impl Default for FileSystemTool {
    fn default() -> Self {
        Self::new()
    }
}