use syn::parse_file;
use tokio::test;

use codecrucible_rust_executor::tools::GenerationTool;

#[test]
async fn function_template_generates_compilable_code() {
    let tool = GenerationTool::new();
    let code = tool
        .generate_code("generate function add params: a: i32, b: i32 returns i32")
        .await
        .unwrap();
    parse_file(&code).expect("Generated function should be valid Rust");
}

#[test]
async fn struct_template_generates_compilable_code() {
    let tool = GenerationTool::new();
    let code = tool
        .generate_code("create struct Person fields: name: String, age: i32")
        .await
        .unwrap();
    parse_file(&code).expect("Generated struct should be valid Rust");
}

#[test]
async fn module_template_generates_compilable_code() {
    let tool = GenerationTool::new();
    let code = tool
        .generate_code("module utilities content: pub fn helper() {}")
        .await
        .unwrap();
    parse_file(&code).expect("Generated module should be valid Rust");
}
