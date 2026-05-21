use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
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
        let kind = if file_type.is_dir() { "directory" } else { "file" };
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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![health_check, open_workspace])
        .run(tauri::generate_context!())
        .expect("failed to run Binder Mini");
}
