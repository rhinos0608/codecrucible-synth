use codecrucible_rust_executor::tools::GenerationTool;

#[tokio::test]
async fn test_generate_function_with_params() {
    let tool = GenerationTool::new();
    let result = tool
        .generate_code("fn add(a: i32, b: i32) -> i32")
        .await
        .expect("generation failed");
    assert!(result.contains("fn add(a: i32, b: i32) -> i32"));
}

#[tokio::test]
async fn test_generate_struct_with_fields() {
    let tool = GenerationTool::new();
    let result = tool
        .generate_code("struct User { id: u32, name: String }")
        .await
        .expect("generation failed");
    assert!(result.contains("pub struct User"));
    assert!(result.contains("pub id: u32"));
    assert!(result.contains("pub name: String"));
    assert!(result.contains("pub fn new(id: u32, name: String) -> Self"));
    assert!(result.contains("id,\n            name,"));
}

#[tokio::test]
async fn test_generate_function_defaults() {
    let tool = GenerationTool::new();
    let result = tool
        .generate_code("create function returns bool")
        .await
        .expect("generation failed");
    assert!(result.contains("fn GeneratedItem() -> bool"));
    assert!(result.contains("false"));
}
