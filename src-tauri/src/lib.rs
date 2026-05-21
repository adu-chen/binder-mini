use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
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
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<WorkspaceEntry>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceMetadata {
    workspace_database_path: String,
    workspace_database_initialized: bool,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentWorkspace {
    root_path: String,
    display_name: String,
    last_opened_at: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceSnapshot {
    workspace: Workspace,
    entries: Vec<WorkspaceEntry>,
    metadata: WorkspaceMetadata,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceOpenResult {
    cancelled: bool,
    snapshot: Option<WorkspaceSnapshot>,
    recent_workspaces: Option<Vec<RecentWorkspace>>,
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
            recent_workspaces: Some(list_recent_workspaces_from_store(
                &recent_workspace_store_path(&app)?,
            )?),
        });
    };

    let metadata = initialize_workspace_metadata(&root_path)?;
    let entries = read_workspace_entries(&root_path, &root_path)?;
    let display_name = root_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Workspace")
        .to_string();

    let recent_workspaces = record_recent_workspace_at_store(
        &recent_workspace_store_path(&app)?,
        RecentWorkspace {
            root_path: root_path.to_string_lossy().to_string(),
            display_name: display_name.clone(),
            last_opened_at: current_unix_seconds(),
        },
    )?;

    Ok(WorkspaceOpenResult {
        cancelled: false,
        snapshot: Some(WorkspaceSnapshot {
            workspace: Workspace {
                root_path: root_path.to_string_lossy().to_string(),
                display_name,
                status: "active",
            },
            entries,
            metadata,
        }),
        recent_workspaces: Some(recent_workspaces),
    })
}

#[tauri::command]
fn list_recent_workspaces(app: tauri::AppHandle) -> Result<Vec<RecentWorkspace>, String> {
    list_recent_workspaces_from_store(&recent_workspace_store_path(&app)?)
}

fn recent_workspace_store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;
    Ok(app_data_dir.join("recent-workspaces.json"))
}

fn list_recent_workspaces_from_store(store_path: &Path) -> Result<Vec<RecentWorkspace>, String> {
    if !store_path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(store_path).map_err(|error| error.to_string())?;
    let parsed: Vec<RecentWorkspace> =
        serde_json::from_str(&content).map_err(|error| error.to_string())?;
    Ok(normalize_recent_workspaces(parsed))
}

fn record_recent_workspace_at_store(
    store_path: &Path,
    workspace: RecentWorkspace,
) -> Result<Vec<RecentWorkspace>, String> {
    if let Some(parent) = store_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let mut recent = list_recent_workspaces_from_store(store_path)?;
    recent.push(workspace);
    let normalized = normalize_recent_workspaces(recent);
    let content = serde_json::to_string_pretty(&normalized).map_err(|error| error.to_string())?;
    fs::write(store_path, content).map_err(|error| error.to_string())?;
    Ok(normalized)
}

fn normalize_recent_workspaces(mut workspaces: Vec<RecentWorkspace>) -> Vec<RecentWorkspace> {
    workspaces.sort_by(|left, right| {
        right
            .last_opened_at
            .cmp(&left.last_opened_at)
            .then_with(|| left.root_path.cmp(&right.root_path))
    });
    let mut deduped = Vec::new();
    for workspace in workspaces {
        if !deduped
            .iter()
            .any(|existing: &RecentWorkspace| existing.root_path == workspace.root_path)
        {
            deduped.push(workspace);
        }
        if deduped.len() >= 10 {
            break;
        }
    }
    deduped
}

fn current_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn initialize_workspace_metadata(root_path: &Path) -> Result<WorkspaceMetadata, String> {
    let binder_dir = root_path.join(".binder");
    fs::create_dir_all(&binder_dir).map_err(|error| error.to_string())?;
    let workspace_database_path = binder_dir.join("workspace.db");
    if !workspace_database_path.exists() {
        fs::write(&workspace_database_path, b"{\"version\":1}\n")
            .map_err(|error| error.to_string())?;
    }
    Ok(WorkspaceMetadata {
        workspace_database_path: workspace_database_path.to_string_lossy().to_string(),
        workspace_database_initialized: workspace_database_path.is_file(),
    })
}

fn read_workspace_entries(
    root_path: &Path,
    current_path: &Path,
) -> Result<Vec<WorkspaceEntry>, String> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(current_path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if should_skip_workspace_internal(root_path, &path) {
            continue;
        }
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        let kind = if file_type.is_dir() {
            "directory"
        } else {
            "file"
        };
        let name = entry.file_name().to_string_lossy().to_string();
        let relative_path = path
            .strip_prefix(root_path)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .to_string();
        let children = if file_type.is_dir() {
            Some(read_workspace_entries(root_path, &path)?)
        } else {
            None
        };
        entries.push(WorkspaceEntry {
            relative_path,
            name,
            kind,
            children,
        });
    }
    sort_workspace_entries(&mut entries);
    Ok(entries)
}

fn sort_workspace_entries(entries: &mut [WorkspaceEntry]) {
    entries.sort_by(|left, right| match (left.kind, right.kind) {
        ("directory", "file") => std::cmp::Ordering::Less,
        ("file", "directory") => std::cmp::Ordering::Greater,
        _ => left.name.cmp(&right.name),
    });
}

fn should_skip_workspace_internal(root_path: &Path, path: &Path) -> bool {
    path.parent() == Some(root_path)
        && path
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(|name| name == ".binder")
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
    let root = PathBuf::from(&workspace_root)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let dir = resolve_workspace_path(&workspace_root, dir_path.as_deref().unwrap_or(""))?;
    if !dir.is_dir() {
        return Err("target is not a directory".to_string());
    }
    Ok(ListFilesResult {
        entries: read_workspace_entries(&root, &dir)?,
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
        if should_skip_workspace_internal(root, &path) {
            continue;
        }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_workspace_root(name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after UNIX_EPOCH")
            .as_nanos();
        std::env::temp_dir().join(format!("binder-mini-{name}-{stamp}"))
    }

    #[test]
    fn initializes_workspace_database_without_exposing_internal_dir() {
        let root = test_workspace_root("metadata");
        fs::create_dir_all(root.join("docs")).expect("fixture workspace should be created");

        let metadata = initialize_workspace_metadata(&root).expect("metadata should initialize");
        let entries = read_workspace_entries(&root, &root).expect("entries should load");

        assert!(metadata.workspace_database_initialized);
        assert!(PathBuf::from(metadata.workspace_database_path).is_file());
        assert!(entries.iter().all(|entry| entry.name != ".binder"));

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn reads_recursive_workspace_entries_with_relative_paths() {
        let root = test_workspace_root("tree");
        fs::create_dir_all(root.join("docs/nested")).expect("fixture tree should be created");
        fs::write(root.join("docs/nested/readme.md"), "hello")
            .expect("fixture file should be written");
        fs::write(root.join("z.txt"), "z").expect("fixture file should be written");

        let entries = read_workspace_entries(&root, &root).expect("entries should load");
        let docs = entries
            .iter()
            .find(|entry| entry.relative_path == "docs")
            .expect("docs directory should exist");
        let nested = docs
            .children
            .as_ref()
            .expect("docs should have children")
            .iter()
            .find(|entry| entry.relative_path == "docs/nested")
            .expect("nested directory should exist");

        assert_eq!(entries[0].kind, "directory");
        assert_eq!(
            nested
                .children
                .as_ref()
                .expect("nested should have children")[0]
                .relative_path,
            "docs/nested/readme.md"
        );

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn records_recent_workspaces_in_user_level_store_ordered_by_time() {
        let root = test_workspace_root("recent");
        fs::create_dir_all(&root).expect("fixture workspace should be created");
        let store_path = root.join("app-data/recent-workspaces.json");

        record_recent_workspace_at_store(
            &store_path,
            RecentWorkspace {
                root_path: "/tmp/a".to_string(),
                display_name: "old-a".to_string(),
                last_opened_at: 1,
            },
        )
        .expect("first recent workspace should be recorded");
        record_recent_workspace_at_store(
            &store_path,
            RecentWorkspace {
                root_path: "/tmp/a".to_string(),
                display_name: "new-a".to_string(),
                last_opened_at: 3,
            },
        )
        .expect("second recent workspace should be recorded");
        let recent = record_recent_workspace_at_store(
            &store_path,
            RecentWorkspace {
                root_path: "/tmp/b".to_string(),
                display_name: "b".to_string(),
                last_opened_at: 2,
            },
        )
        .expect("third recent workspace should be recorded");

        assert_eq!(recent.len(), 2);
        assert_eq!(recent[0].root_path, "/tmp/a");
        assert_eq!(recent[0].display_name, "new-a");
        assert_eq!(recent[1].root_path, "/tmp/b");
        assert!(store_path.is_file());

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            health_check,
            open_workspace,
            list_recent_workspaces,
            read_workspace_file,
            write_workspace_file,
            read_file,
            list_files,
            search_files
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Binder Mini");
}
