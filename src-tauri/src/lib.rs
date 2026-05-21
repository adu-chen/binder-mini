use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Workspace {
    root_path: String,
    display_name: String,
    status: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceEntry {
    name: String,
    relative_path: String,
    kind: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceSnapshot {
    workspace: Workspace,
    entries: Vec<WorkspaceEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceOpenResult {
    cancelled: bool,
    snapshot: Option<WorkspaceSnapshot>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ListFilesResult {
    entries: Vec<WorkspaceEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchResult {
    file_path: String,
    preview: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EditorDocument {
    file_path: String,
    workspace_root: String,
    content: String,
    mode: &'static str,
    dirty: bool,
}

#[tauri::command]
fn health_check() -> &'static str {
    "ok"
}

#[tauri::command]
async fn open_workspace(app: tauri::AppHandle) -> Result<WorkspaceOpenResult, String> {
    let selected = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .map(|path| path.into_path())
        .transpose()
        .map_err(|error| error.to_string())?;

    let Some(root_path) = selected else {
        return Ok(WorkspaceOpenResult {
            cancelled: true,
            snapshot: None,
        });
    };

    let entries = read_workspace_entries(&root_path)?;
    let display_name = root_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Workspace")
        .to_string();

    Ok(WorkspaceOpenResult {
        cancelled: false,
        snapshot: Some(WorkspaceSnapshot {
            workspace: Workspace {
                root_path: root_path.to_string_lossy().to_string(),
                display_name,
                status: "active",
            },
            entries,
        }),
    })
}

fn read_workspace_entries(root_path: &Path) -> Result<Vec<WorkspaceEntry>, String> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(root_path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !is_direct_child(root_path, &path) {
            continue;
        }
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        let kind = if file_type.is_dir() {
            "directory"
        } else {
            "file"
        };
        let name = entry.file_name().to_string_lossy().to_string();
        entries.push(WorkspaceEntry {
            relative_path: name.clone(),
            name,
            kind,
        });
    }
    entries.sort_by(|left, right| match (left.kind, right.kind) {
        ("directory", "file") => std::cmp::Ordering::Less,
        ("file", "directory") => std::cmp::Ordering::Greater,
        _ => left.name.cmp(&right.name),
    });
    Ok(entries)
}

fn is_direct_child(root_path: &Path, path: &PathBuf) -> bool {
    path.parent() == Some(root_path)
}

#[tauri::command]
fn read_workspace_file(
    workspace_root: String,
    relative_path: String,
) -> Result<EditorDocument, String> {
    let file_path = resolve_workspace_file(&workspace_root, &relative_path)?;
    let bytes = fs::read(&file_path).map_err(|error| error.to_string())?;
    let content = String::from_utf8_lossy(&bytes).to_string();
    Ok(EditorDocument {
        file_path: relative_path.clone(),
        workspace_root,
        content,
        mode: editor_mode_for_path(&relative_path),
        dirty: false,
    })
}

#[tauri::command]
fn read_file(workspace_root: String, file_path: String) -> Result<String, String> {
    let path = resolve_workspace_file(&workspace_root, &file_path)?;
    fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_files(workspace_root: String, dir_path: Option<String>) -> Result<ListFilesResult, String> {
    let dir = resolve_workspace_path(&workspace_root, dir_path.as_deref().unwrap_or(""))?;
    if !dir.is_dir() {
        return Err("target is not a directory".to_string());
    }
    Ok(ListFilesResult {
        entries: read_workspace_entries(&dir)?,
    })
}

#[tauri::command]
fn search_files(workspace_root: String, query: String) -> Result<Vec<SearchResult>, String> {
    let trimmed_query = query.trim().to_lowercase();
    if trimmed_query.is_empty() {
        return Ok(Vec::new());
    }
    let root = PathBuf::from(&workspace_root)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let mut results = Vec::new();
    collect_search_results(&root, &root, &trimmed_query, &mut results)?;
    Ok(results)
}

#[tauri::command]
fn write_workspace_file(
    workspace_root: String,
    relative_path: String,
    content: String,
) -> Result<EditorDocument, String> {
    if editor_mode_for_path(&relative_path) != "editable" {
        return Err("readonly file cannot be saved".to_string());
    }
    let file_path = resolve_workspace_file(&workspace_root, &relative_path)?;
    fs::write(&file_path, content.as_bytes()).map_err(|error| error.to_string())?;
    Ok(EditorDocument {
        file_path: relative_path.clone(),
        workspace_root,
        content,
        mode: "editable",
        dirty: false,
    })
}

fn resolve_workspace_file(workspace_root: &str, relative_path: &str) -> Result<PathBuf, String> {
    let file_path = resolve_workspace_path(workspace_root, relative_path)?;
    if !file_path.is_file() {
        return Err("target is not a file".to_string());
    }
    Ok(file_path)
}

fn resolve_workspace_path(workspace_root: &str, relative_path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(workspace_root)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let relative = Path::new(relative_path);
    if relative.is_absolute()
        || relative.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("file target is outside Workspace".to_string());
    }
    let target_path = root.join(relative);
    let comparable_path = target_path
        .canonicalize()
        .unwrap_or_else(|_| target_path.clone());
    if !comparable_path.starts_with(&root) {
        return Err("file target is outside Workspace".to_string());
    }
    Ok(target_path)
}

fn editor_mode_for_path(relative_path: &str) -> &'static str {
    let lower = relative_path.to_lowercase();
    if lower.ends_with(".md") || lower.ends_with(".txt") {
        "editable"
    } else {
        "readonly"
    }
}

fn collect_search_results(
    root: &Path,
    current: &Path,
    query: &str,
    results: &mut Vec<SearchResult>,
) -> Result<(), String> {
    if results.len() >= 20 {
        return Ok(());
    }
    for entry in fs::read_dir(current).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_dir() {
            collect_search_results(root, &path, query, results)?;
        } else if file_type.is_file() {
            let Ok(content) = fs::read_to_string(&path) else {
                continue;
            };
            let lower = content.to_lowercase();
            if let Some(index) = lower.find(query) {
                let preview = content[index..].chars().take(120).collect::<String>();
                let file_path = path
                    .strip_prefix(root)
                    .map_err(|error| error.to_string())?
                    .to_string_lossy()
                    .to_string();
                results.push(SearchResult { file_path, preview });
            }
        }
        if results.len() >= 20 {
            break;
        }
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            health_check,
            open_workspace,
            read_workspace_file,
            write_workspace_file,
            read_file,
            list_files,
            search_files
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Binder Mini");
}
