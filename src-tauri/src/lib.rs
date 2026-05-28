use futures_util::StreamExt;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
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
struct PathConflict {
    code: &'static str,
    target_path: String,
    existing_kind: &'static str,
    message: String,
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
struct WorkspaceMutationResult {
    success: bool,
    entries: Vec<WorkspaceEntry>,
    #[serde(skip_serializing_if = "Option::is_none")]
    conflict: Option<PathConflict>,
}

/*
 * @GOV
 * codes: BR-DE-PERSIST-002
 * type: DATA
 * chain: DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-PERSIST-002
 * boundary: in=PendingDiffRecord and workspace_root path | out=pending_diffs row upserted to WorkspaceDatabase
 * term_ref: TERM-WS-002, TERM-DE-001, TERM-DE-005
 */
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PendingDiffRecord {
    id: String,
    file_path: String,
    original_text: String,
    new_text: String,
    summary: String,
    status: String,
    effective_path: String,
    source_tool_id: String,
    base_revision: String,
    applied_range_from: Option<i64>,
    applied_range_to: Option<i64>,
    created_at: i64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TerminalDiffCardRecord {
    diff_id: String,
    status: String,
    message: String,
    source_tool_id: String,
    resolved_at: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RecoveredDiffsRecord {
    restored: Vec<PendingDiffRecord>,
    expired: Vec<TerminalDiffCardRecord>,
}

/*
 * @GOV
 * codes: BR-AG-PERSIST-001
 * type: DATA
 * chain: WS-CLOSE, AG-SEND-MESSAGE, WS-OPEN
 * rules: BR-AG-PERSIST-001
 * boundary: in=AgentMessage list and workspace_root path | out=chat_messages table upserted to WorkspaceDatabase
 * term_ref: TERM-WS-002, TERM-AG-010, TERM-AG-014
 */
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatMessageRecord {
    id: String,
    role: String,
    content: String,
    stream_status: Option<String>,
    tool_call_id: Option<String>,
    input_references_json: Option<String>,
    /// BR-AG-DATA-004: active file path at message creation time; epoch stamp for
    /// buildChatPayload() history sanitisation. NULL = no active file.
    active_file_path: Option<String>,
    created_at: i64,
    session_id: String,
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
    rebuild_search_index(&root_path)?;
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

fn current_unix_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

fn chat_debug_log(app: &tauri::AppHandle, line: &str) {
    println!("{line}");
    let Ok(config_dir) = app.path().app_config_dir() else {
        return;
    };
    if fs::create_dir_all(&config_dir).is_err() {
        return;
    }
    let log_path = config_dir.join("chat-debug.log");
    let Ok(mut file) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    else {
        return;
    };
    let _ = writeln!(file, "{} {}", current_unix_seconds(), line);
}

fn chat_debug_error(app: &tauri::AppHandle, line: &str) {
    eprintln!("{line}");
    chat_debug_log(app, line);
}

fn prompt_debug_enabled() -> bool {
    std::env::var("BINDER_CHAT_PROMPT_DEBUG")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn initialize_workspace_metadata(root_path: &Path) -> Result<WorkspaceMetadata, String> {
    let binder_dir = root_path.join(".binder");
    fs::create_dir_all(&binder_dir).map_err(|error| error.to_string())?;
    let workspace_database_path = workspace_database_path(root_path);
    open_workspace_database(&workspace_database_path)?;
    let search_database_path = search_database_path(root_path);
    initialize_search_database(&search_database_path)?;
    rebuild_search_index(root_path)?;
    Ok(WorkspaceMetadata {
        workspace_database_path: workspace_database_path.to_string_lossy().to_string(),
        workspace_database_initialized: workspace_database_path.is_file(),
    })
}

fn workspace_database_path(root_path: &Path) -> PathBuf {
    root_path.join(".binder").join("workspace.db")
}

fn search_database_path(root_path: &Path) -> PathBuf {
    root_path.join(".binder").join("search.db")
}

fn open_workspace_database(database_path: &Path) -> Result<Connection, String> {
    if let Some(parent) = database_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let connection = Connection::open(database_path).map_err(|error| error.to_string())?;
    match initialize_workspace_database_schema(&connection) {
        Ok(()) => {
            migrate_workspace_database_schema(&connection);
            Ok(connection)
        }
        Err(schema_error) => {
            drop(connection);
            if database_path.exists() {
                let backup_path =
                    database_path.with_extension(format!("db.bak.{}", current_unix_seconds()));
                fs::rename(database_path, backup_path).map_err(|error| error.to_string())?;
            }
            let connection = Connection::open(database_path).map_err(|error| error.to_string())?;
            initialize_workspace_database_schema(&connection).map_err(|error| {
                format!("failed to initialize workspace database after recovery: {schema_error}; {error}")
            })?;
            migrate_workspace_database_schema(&connection);
            Ok(connection)
        }
    }
}

/// Add columns introduced after earlier MVP schemas to pre-existing workspace tables.
/// ALTER TABLE ADD COLUMN returns an error when the column already exists — we ignore those.
/// NOT NULL columns require a DEFAULT so existing rows stay valid.
fn migrate_workspace_database_schema(connection: &Connection) {
    let migrations: &[&str] = &[
        "ALTER TABLE pending_diffs ADD COLUMN summary TEXT NOT NULL DEFAULT '';",
        "ALTER TABLE pending_diffs ADD COLUMN effective_path TEXT NOT NULL DEFAULT 'open-file';",
        "ALTER TABLE pending_diffs ADD COLUMN source_tool_id TEXT NOT NULL DEFAULT '';",
        "ALTER TABLE pending_diffs ADD COLUMN base_revision TEXT NOT NULL DEFAULT '';",
        "ALTER TABLE pending_diffs ADD COLUMN applied_range_from INTEGER;",
        "ALTER TABLE pending_diffs ADD COLUMN applied_range_to INTEGER;",
        "ALTER TABLE chat_messages ADD COLUMN stream_status TEXT;",
        "ALTER TABLE chat_messages ADD COLUMN tool_call_id TEXT;",
        "ALTER TABLE chat_messages ADD COLUMN input_references_json TEXT;",
        "ALTER TABLE chat_messages ADD COLUMN session_id TEXT NOT NULL DEFAULT '';",
        // BR-AG-DATA-004: epoch stamp for prompt assembly pipeline history sanitisation
        "ALTER TABLE chat_messages ADD COLUMN active_file_path TEXT;",
        "ALTER TABLE terminal_diff_cards ADD COLUMN source_tool_id TEXT NOT NULL DEFAULT '';",
    ];
    for stmt in migrations {
        // Silence "duplicate column name" errors — they mean the column already exists.
        let _ = connection.execute_batch(stmt);
    }

    // Remove the legacy `chat_tab_id TEXT NOT NULL` column that causes INSERT failures
    // when an older workspace.db is opened with the current schema.
    // SQLite does not support ALTER COLUMN, so we use the canonical
    // create-copy-drop-rename pattern.  The PRAGMA guard makes this idempotent.
    let has_chat_tab_id = connection
        .prepare("PRAGMA table_info(chat_messages)")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).any(|col| col == "chat_tab_id"))
        })
        .unwrap_or(false);

    if has_chat_tab_id {
        let _ = connection.execute_batch(
            "CREATE TABLE IF NOT EXISTS chat_messages_v2 (\
                id TEXT PRIMARY KEY, \
                role TEXT NOT NULL, \
                content TEXT NOT NULL, \
                stream_status TEXT, \
                tool_call_id TEXT, \
                input_references_json TEXT, \
                active_file_path TEXT, \
                created_at INTEGER NOT NULL, \
                session_id TEXT NOT NULL \
            ); \
            INSERT OR IGNORE INTO chat_messages_v2 \
                (id, role, content, stream_status, tool_call_id, input_references_json, active_file_path, created_at, session_id) \
                SELECT id, role, content, stream_status, tool_call_id, input_references_json, active_file_path, created_at, session_id \
                FROM chat_messages; \
            DROP TABLE chat_messages; \
            ALTER TABLE chat_messages_v2 RENAME TO chat_messages;",
        );
    }

    // Remove the legacy `source TEXT NOT NULL` column from older pending_diffs
    // tables. Current writes use `source_tool_id`; leaving `source` in place
    // makes INSERTs fail because SQLite still enforces the orphan NOT NULL column.
    let has_pending_diff_source = connection
        .prepare("PRAGMA table_info(pending_diffs)")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).any(|col| col == "source"))
        })
        .unwrap_or(false);

    if has_pending_diff_source {
        let _ = connection.execute_batch(
            "DROP TABLE IF EXISTS pending_diffs_v2; \
            CREATE TABLE pending_diffs_v2 (\
                id TEXT PRIMARY KEY, \
                file_path TEXT NOT NULL, \
                original_text TEXT NOT NULL, \
                new_text TEXT NOT NULL, \
                summary TEXT NOT NULL, \
                status TEXT NOT NULL, \
                effective_path TEXT NOT NULL CHECK(effective_path IN ('open-file','closed-file')), \
                source_tool_id TEXT NOT NULL, \
                base_revision TEXT NOT NULL, \
                applied_range_from INTEGER, \
                applied_range_to INTEGER, \
                created_at INTEGER NOT NULL \
            ); \
            INSERT OR IGNORE INTO pending_diffs_v2 \
                (id, file_path, original_text, new_text, summary, status, effective_path, \
                 source_tool_id, base_revision, applied_range_from, applied_range_to, created_at) \
                SELECT id, file_path, original_text, new_text, summary, status, effective_path, \
                       CASE WHEN source_tool_id IS NOT NULL AND source_tool_id <> '' THEN source_tool_id ELSE source END, \
                       base_revision, applied_range_from, applied_range_to, created_at \
                FROM pending_diffs; \
            DROP TABLE pending_diffs; \
            ALTER TABLE pending_diffs_v2 RENAME TO pending_diffs;",
        );
    }
}

/*
 * @GOV
 * codes: BR-WS-STATE-002-IMPL-WS-WS-OPEN-001
 * type: DATA
 * chain: WS-OPEN
 * rules: BR-WS-STATE-002
 * boundary: in=workspace_root path | out=workspace.db schema (workspace_settings, pending_diffs, terminal_diff_cards, chat_messages)
 */
fn initialize_workspace_database_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS workspace_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS pending_diffs (
                id TEXT PRIMARY KEY,
                file_path TEXT NOT NULL,
                original_text TEXT NOT NULL,
                new_text TEXT NOT NULL,
                summary TEXT NOT NULL,
                status TEXT NOT NULL,
                effective_path TEXT NOT NULL CHECK(effective_path IN ('open-file','closed-file')),
                source_tool_id TEXT NOT NULL,
                base_revision TEXT NOT NULL,
                applied_range_from INTEGER,
                applied_range_to INTEGER,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS terminal_diff_cards (
                id TEXT PRIMARY KEY,
                diff_id TEXT NOT NULL,
                status TEXT NOT NULL,
                message TEXT NOT NULL,
                source_tool_id TEXT NOT NULL DEFAULT '',
                resolved_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                stream_status TEXT,
                tool_call_id TEXT,
                input_references_json TEXT,
                active_file_path TEXT,
                created_at INTEGER NOT NULL,
                session_id TEXT NOT NULL
            );
            "#,
        )
        .map_err(|error| error.to_string())
}

/*
 * @GOV
 * codes: BR-WS-DATA-005-IMPL-WS-WS-OPEN-002
 * type: DATA
 * chain: WS-OPEN,WS-SEARCH
 * rules: BR-WS-DATA-005
 * boundary: in=search_db_path | out=search.db FTS5 schema (search_index table)
 */
fn initialize_search_database(search_db_path: &Path) -> Result<(), String> {
    if let Some(parent) = search_db_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let connection = Connection::open(search_db_path).map_err(|error| error.to_string())?;
    connection
        .execute_batch(
            r#"
            CREATE VIRTUAL TABLE IF NOT EXISTS search_index
            USING fts5(file_path UNINDEXED, file_name, content, tokenize = 'unicode61');
            "#,
        )
        .map_err(|error| error.to_string())
}

fn rebuild_search_index(root_path: &Path) -> Result<(), String> {
    let search_db_path = search_database_path(root_path);
    initialize_search_database(&search_db_path)?;
    let mut connection = Connection::open(&search_db_path).map_err(|error| error.to_string())?;
    let mut documents: Vec<(String, String, String)> = Vec::new();
    collect_search_documents(root_path, root_path, &mut documents)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM search_index", [])
        .map_err(|error| error.to_string())?;
    for (file_path, file_name, content) in documents {
        transaction
            .execute(
                "INSERT INTO search_index (file_path, file_name, content) VALUES (?1, ?2, ?3)",
                params![file_path, file_name, content],
            )
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())
}

fn collect_search_documents(
    root: &Path,
    current: &Path,
    documents: &mut Vec<(String, String, String)>,
) -> Result<(), String> {
    for entry in fs::read_dir(current).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if should_skip_workspace_internal(root, &path) {
            continue;
        }
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_dir() {
            collect_search_documents(root, &path, documents)?;
        } else if file_type.is_file() {
            let Ok(content) = fs::read_to_string(&path) else {
                continue;
            };
            let file_path = path
                .strip_prefix(root)
                .map_err(|error| error.to_string())?
                .to_string_lossy()
                .to_string();
            let file_name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            documents.push((file_path, file_name, content));
        }
    }
    Ok(())
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
fn create_workspace_file(
    workspace_root: String,
    relative_path: String,
) -> Result<WorkspaceMutationResult, String> {
    create_workspace_item(&workspace_root, &relative_path, "file")
}

#[tauri::command]
fn create_workspace_folder(
    workspace_root: String,
    relative_path: String,
) -> Result<WorkspaceMutationResult, String> {
    create_workspace_item(&workspace_root, &relative_path, "directory")
}

#[tauri::command]
fn rename_workspace_item(
    workspace_root: String,
    relative_path: String,
    new_name: String,
) -> Result<WorkspaceMutationResult, String> {
    rename_workspace_item_impl(&workspace_root, &relative_path, &new_name)
}

#[tauri::command]
fn move_workspace_item(
    workspace_root: String,
    source_path: String,
    target_path: String,
) -> Result<WorkspaceMutationResult, String> {
    move_workspace_item_impl(&workspace_root, &source_path, &target_path)
}

#[tauri::command]
fn delete_workspace_item(
    workspace_root: String,
    relative_path: String,
) -> Result<WorkspaceMutationResult, String> {
    delete_workspace_item_impl(&workspace_root, &relative_path)
}

fn create_workspace_item(
    workspace_root: &str,
    relative_path: &str,
    kind: &'static str,
) -> Result<WorkspaceMutationResult, String> {
    let root = PathBuf::from(workspace_root)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    ensure_workspace_mutation_path(relative_path)?;
    let target = resolve_workspace_path(workspace_root, relative_path)?;
    if target.exists() {
        return Ok(WorkspaceMutationResult {
            success: false,
            entries: read_workspace_entries(&root, &root)?,
            conflict: Some(path_conflict(&target, relative_path)),
        });
    }
    let parent = target
        .parent()
        .ok_or_else(|| "target parent is not a directory".to_string())?;
    if !parent.is_dir() {
        return Err("target parent is not a directory".to_string());
    }
    if kind == "directory" {
        fs::create_dir(&target).map_err(|error| error.to_string())?;
    } else {
        fs::write(&target, b"").map_err(|error| error.to_string())?;
    }
    rebuild_search_index(&root)?;
    Ok(WorkspaceMutationResult {
        success: true,
        entries: read_workspace_entries(&root, &root)?,
        conflict: None,
    })
}

fn rename_workspace_item_impl(
    workspace_root: &str,
    relative_path: &str,
    new_name: &str,
) -> Result<WorkspaceMutationResult, String> {
    ensure_workspace_mutation_path(relative_path)?;
    ensure_workspace_item_name(new_name)?;
    let root = PathBuf::from(workspace_root)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let source = resolve_existing_workspace_item(workspace_root, relative_path)?;
    let parent = source
        .parent()
        .ok_or_else(|| "target parent is not a directory".to_string())?;
    let target = parent.join(new_name);
    ensure_path_inside_root(&root, &target)?;
    if target.exists() {
        return Ok(WorkspaceMutationResult {
            success: false,
            entries: read_workspace_entries(&root, &root)?,
            conflict: Some(path_conflict(&target, new_name)),
        });
    }
    fs::rename(&source, &target).map_err(|error| error.to_string())?;
    rebuild_search_index(&root)?;
    Ok(WorkspaceMutationResult {
        success: true,
        entries: read_workspace_entries(&root, &root)?,
        conflict: None,
    })
}

fn move_workspace_item_impl(
    workspace_root: &str,
    source_path: &str,
    target_path: &str,
) -> Result<WorkspaceMutationResult, String> {
    ensure_workspace_mutation_path(source_path)?;
    ensure_workspace_mutation_path(target_path)?;
    let root = PathBuf::from(workspace_root)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let source = resolve_existing_workspace_item(workspace_root, source_path)?;
    let target = resolve_workspace_path(workspace_root, target_path)?;
    if target.exists() {
        return Ok(WorkspaceMutationResult {
            success: false,
            entries: read_workspace_entries(&root, &root)?,
            conflict: Some(path_conflict(&target, target_path)),
        });
    }
    let parent = target
        .parent()
        .ok_or_else(|| "target parent is not a directory".to_string())?;
    if !parent.is_dir() {
        return Err("target parent is not a directory".to_string());
    }
    fs::rename(&source, &target).map_err(|error| error.to_string())?;
    rebuild_search_index(&root)?;
    Ok(WorkspaceMutationResult {
        success: true,
        entries: read_workspace_entries(&root, &root)?,
        conflict: None,
    })
}

fn delete_workspace_item_impl(
    workspace_root: &str,
    relative_path: &str,
) -> Result<WorkspaceMutationResult, String> {
    ensure_workspace_mutation_path(relative_path)?;
    let root = PathBuf::from(workspace_root)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let target = resolve_existing_workspace_item(workspace_root, relative_path)?;
    if target.is_dir() {
        fs::remove_dir_all(&target).map_err(|error| error.to_string())?;
    } else {
        fs::remove_file(&target).map_err(|error| error.to_string())?;
    }
    rebuild_search_index(&root)?;
    Ok(WorkspaceMutationResult {
        success: true,
        entries: read_workspace_entries(&root, &root)?,
        conflict: None,
    })
}

fn resolve_existing_workspace_item(
    workspace_root: &str,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let target = resolve_workspace_path(workspace_root, relative_path)?;
    if !target.exists() {
        return Err("target does not exist".to_string());
    }
    Ok(target)
}

fn ensure_workspace_item_name(name: &str) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed == ".binder" {
        return Err("invalid Workspace item name".to_string());
    }
    let path = Path::new(trimmed);
    if path.components().count() != 1
        || path.is_absolute()
        || path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("invalid Workspace item name".to_string());
    }
    Ok(())
}

fn ensure_workspace_mutation_path(relative_path: &str) -> Result<(), String> {
    let mut components = Path::new(relative_path).components();
    let Some(Component::Normal(first)) = components.next() else {
        return Err("invalid Workspace item path".to_string());
    };
    if first == ".binder" {
        return Err("Workspace internal data cannot be modified".to_string());
    }
    Ok(())
}

fn ensure_path_inside_root(root: &Path, target: &Path) -> Result<(), String> {
    let comparable_path = target
        .canonicalize()
        .unwrap_or_else(|_| target.to_path_buf());
    if !comparable_path.starts_with(root) {
        return Err("file target is outside Workspace".to_string());
    }
    Ok(())
}

fn path_conflict(target: &Path, relative_path: &str) -> PathConflict {
    let existing_kind = if target.is_file() {
        "file"
    } else if target.is_dir() {
        "directory"
    } else {
        "other"
    };
    PathConflict {
        code: "PATH_CONFLICT",
        target_path: relative_path.to_string(),
        existing_kind,
        message: format!("Target path already exists: {relative_path}"),
    }
}

/*
 * @GOV
 * codes: BR-DE-PERSIST-002
 * type: IO
 * chain: DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-PERSIST-002
 * boundary: in=PendingDiffRecord and workspace_root path | out=pending_diffs row upserted to WorkspaceDatabase
 * term_ref: TERM-WS-002, TERM-DE-001, TERM-DE-005
 */
#[tauri::command]
fn save_pending_diff(workspace_root: String, diff: PendingDiffRecord) -> Result<(), String> {
    let db_path = workspace_database_path(&PathBuf::from(&workspace_root));
    let conn = open_workspace_database(&db_path)?;
    conn.execute(
        "INSERT OR REPLACE INTO pending_diffs \
         (id, file_path, original_text, new_text, summary, status, effective_path, \
          source_tool_id, base_revision, applied_range_from, applied_range_to, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            diff.id, diff.file_path, diff.original_text, diff.new_text,
            diff.summary, diff.status, diff.effective_path, diff.source_tool_id,
            diff.base_revision, diff.applied_range_from, diff.applied_range_to, diff.created_at
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

/*
 * @GOV
 * codes: BR-DE-PERSIST-002
 * type: IO
 * chain: DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-PERSIST-002
 * boundary: in=diff_id string and status string | out=pending_diffs.status updated in WorkspaceDatabase
 * term_ref: TERM-WS-002, TERM-DE-001
 */
#[tauri::command]
fn update_diff_status(workspace_root: String, diff_id: String, status: String) -> Result<(), String> {
    let db_path = workspace_database_path(&PathBuf::from(&workspace_root));
    let conn = Connection::open(&db_path).map_err(|error| error.to_string())?;
    conn.execute(
        "UPDATE pending_diffs SET status = ?2 WHERE id = ?1",
        params![diff_id, status],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn save_terminal_card_with_conn(
    conn: &Connection,
    card: &TerminalDiffCardRecord,
) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO terminal_diff_cards \
         (id, diff_id, status, message, source_tool_id, resolved_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            &card.diff_id,
            &card.diff_id,
            &card.status,
            &card.message,
            &card.source_tool_id,
            card.resolved_at,
        ],
    )
    .map_err(|error| error.to_string())?;
    conn.execute(
        "DELETE FROM pending_diffs WHERE id = ?1",
        params![&card.diff_id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

/*
 * @GOV
 * codes: BR-DE-PERSIST-002
 * type: IO
 * chain: DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-PERSIST-002
 * boundary: in=TerminalDiffCardRecord and workspace_root path | out=terminal_diff_cards upserted and matching pending_diffs row deleted
 * term_ref: TERM-WS-002, TERM-DE-002
 */
#[tauri::command]
fn save_terminal_card(workspace_root: String, card: TerminalDiffCardRecord) -> Result<(), String> {
    save_terminal_cards(workspace_root, vec![card])
}

/*
 * @GOV
 * codes: BR-DE-PERSIST-002, BR-DE-STATE-013
 * type: IO
 * chain: WS-CLOSE, DE-EXPIRE-DIFF
 * rules: BR-DE-PERSIST-002, BR-DE-STATE-013
 * boundary: in=TerminalDiffCardRecord list and workspace_root path | out=batch terminal_diff_cards upsert and pending_diffs cleanup in one transaction
 * term_ref: TERM-WS-002, TERM-DE-002
 */
#[tauri::command]
fn save_terminal_cards(
    workspace_root: String,
    cards: Vec<TerminalDiffCardRecord>,
) -> Result<(), String> {
    let db_path = workspace_database_path(&PathBuf::from(&workspace_root));
    let mut conn = open_workspace_database(&db_path)?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    for card in &cards {
        save_terminal_card_with_conn(&tx, card)?;
    }
    tx.commit().map_err(|error| error.to_string())?;
    Ok(())
}

/*
 * @GOV
 * codes: BR-DE-PERSIST-002, BR-WS-STATE-002
 * type: QUERY
 * chain: WS-OPEN, DE-CREATE-DIFF
 * rules: BR-DE-PERSIST-002, BR-WS-STATE-002
 * boundary: in=workspace_root path | out=PendingDiffRecord list of non-terminal PendingDiff rows from WorkspaceDatabase
 * term_ref: TERM-WS-002, TERM-DE-001, TERM-DE-005
 */
#[tauri::command]
fn load_diffs_from_workspace(workspace_root: String) -> Result<Vec<PendingDiffRecord>, String> {
    let db_path = workspace_database_path(&PathBuf::from(&workspace_root));
    if !db_path.is_file() {
        return Ok(Vec::new());
    }
    let conn = Connection::open(&db_path).map_err(|error| error.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, file_path, original_text, new_text, summary, status, effective_path, \
             source_tool_id, base_revision, applied_range_from, applied_range_to, created_at \
             FROM pending_diffs \
             WHERE status NOT IN ('accepted', 'rejected', 'expired', 'error')",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(PendingDiffRecord {
                id: row.get(0)?,
                file_path: row.get(1)?,
                original_text: row.get(2)?,
                new_text: row.get(3)?,
                summary: row.get(4)?,
                status: row.get(5)?,
                effective_path: row.get(6)?,
                source_tool_id: row.get(7)?,
                base_revision: row.get(8)?,
                applied_range_from: row.get(9)?,
                applied_range_to: row.get(10)?,
                created_at: row.get(11)?,
            })
        })
        .map_err(|error| error.to_string())?;
    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| error.to_string())?);
    }
    Ok(records)
}

fn sha256_file_hex(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let digest = Sha256::digest(&bytes);
    Ok(format!("{:x}", digest))
}

#[tauri::command]
fn hash_workspace_file(workspace_root: String, file_path: String) -> Result<String, String> {
    let path = resolve_workspace_file(&workspace_root, &file_path)?;
    sha256_file_hex(&path)
}

/*
 * @GOV
 * codes: BR-DE-PERSIST-002, BR-WS-STATE-002
 * type: IO
 * chain: WS-OPEN, DE-CREATE-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-PERSIST-002, BR-WS-STATE-002
 * boundary: in=workspace_root path | out=baseRevision-checked PendingDiff records restored or expired terminal_diff_cards persisted
 * term_ref: TERM-WS-002, TERM-DE-001, TERM-DE-002, TERM-DE-005
 */
#[tauri::command]
fn recover_diffs_from_workspace(workspace_root: String) -> Result<RecoveredDiffsRecord, String> {
    let records = load_diffs_from_workspace(workspace_root.clone())?;
    if records.is_empty() {
        return Ok(RecoveredDiffsRecord {
            restored: Vec::new(),
            expired: Vec::new(),
        });
    }

    let db_path = workspace_database_path(&PathBuf::from(&workspace_root));
    let mut conn = open_workspace_database(&db_path)?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    let mut restored = Vec::new();
    let mut expired = Vec::new();

    for mut record in records {
        let matches_base = resolve_workspace_file(&workspace_root, &record.file_path)
            .and_then(|path| sha256_file_hex(&path))
            .map(|hash| hash == record.base_revision)
            .unwrap_or(false);

        if matches_base {
            if record.status == "preapplied" {
                record.status = "pending".to_string();
                record.effective_path = "closed-file".to_string();
                record.applied_range_from = None;
                record.applied_range_to = None;
                tx.execute(
                    "UPDATE pending_diffs \
                     SET status = 'pending', effective_path = 'closed-file', \
                         applied_range_from = NULL, applied_range_to = NULL \
                     WHERE id = ?1",
                    params![record.id],
                )
                .map_err(|error| error.to_string())?;
            }
            restored.push(record);
        } else {
            let card = TerminalDiffCardRecord {
                diff_id: record.id,
                status: "expired".to_string(),
                message: "Diff expired".to_string(),
                source_tool_id: record.source_tool_id,
                resolved_at: current_unix_millis(),
            };
            save_terminal_card_with_conn(&tx, &card)?;
            expired.push(card);
        }
    }

    tx.commit().map_err(|error| error.to_string())?;
    Ok(RecoveredDiffsRecord { restored, expired })
}

/*
 * @GOV
 * codes: BR-AG-PERSIST-001
 * type: IO
 * chain: WS-CLOSE, AG-SEND-MESSAGE
 * rules: BR-AG-PERSIST-001
 * boundary: in=AgentMessage list and workspace_root path | out=chat_messages table upserted to WorkspaceDatabase
 * term_ref: TERM-WS-002, TERM-AG-010, TERM-AG-014
 */
#[tauri::command]
fn save_chat_messages(workspace_root: String, messages: Vec<ChatMessageRecord>) -> Result<(), String> {
    if messages.is_empty() {
        return Ok(());
    }
    let db_path = workspace_database_path(&PathBuf::from(&workspace_root));
    let mut conn = open_workspace_database(&db_path)?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    tx.execute(
        "DELETE FROM chat_messages WHERE session_id = ?1",
        params![workspace_root],
    )
    .map_err(|error| error.to_string())?;
    for msg in &messages {
        tx.execute(
        "INSERT INTO chat_messages \
             (id, role, content, stream_status, tool_call_id, input_references_json, \
              active_file_path, created_at, session_id) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                msg.id, msg.role, msg.content, msg.stream_status,
                msg.tool_call_id, msg.input_references_json,
                msg.active_file_path, msg.created_at, workspace_root
            ],
        )
        .map_err(|error| error.to_string())?;
    }
    tx.commit().map_err(|error| error.to_string())
}

/*
 * @GOV
 * codes: BR-AG-PERSIST-001
 * type: IO
 * chain: AG-SEND-MESSAGE
 * rules: BR-AG-PERSIST-001
 * boundary: in=workspace_root path | out=chat_messages rows deleted from WorkspaceDatabase for current session
 * term_ref: TERM-WS-002, TERM-AG-010, TERM-AG-014
 */
#[tauri::command]
fn clear_chat_messages(workspace_root: String) -> Result<(), String> {
    let db_path = workspace_database_path(&PathBuf::from(&workspace_root));
    if !db_path.is_file() {
        return Ok(());
    }
    let conn = Connection::open(&db_path).map_err(|error| error.to_string())?;
    conn.execute(
        "DELETE FROM chat_messages WHERE session_id = ?1",
        params![workspace_root],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

/*
 * @GOV
 * codes: BR-AG-PERSIST-001
 * type: QUERY
 * chain: WS-OPEN, AG-SEND-MESSAGE
 * rules: BR-AG-PERSIST-001
 * boundary: in=workspace_root path | out=ChatMessageRecord list ordered by created_at from WorkspaceDatabase chat_messages
 * term_ref: TERM-WS-002, TERM-AG-010, TERM-AG-014
 */
#[tauri::command]
fn load_chat_messages(workspace_root: String) -> Result<Vec<ChatMessageRecord>, String> {
    let db_path = workspace_database_path(&PathBuf::from(&workspace_root));
    if !db_path.is_file() {
        return Ok(Vec::new());
    }
    let conn = Connection::open(&db_path).map_err(|error| error.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, role, content, stream_status, tool_call_id, input_references_json, \
             active_file_path, created_at, session_id \
             FROM chat_messages WHERE session_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map(params![workspace_root], |row| {
            Ok(ChatMessageRecord {
                id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                stream_status: row.get(3)?,
                tool_call_id: row.get(4)?,
                input_references_json: row.get(5)?,
                active_file_path: row.get(6)?,
                created_at: row.get(7)?,
                session_id: row.get(8)?,
            })
        })
        .map_err(|error| error.to_string())?;
    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| error.to_string())?);
    }
    Ok(records)
}

#[tauri::command]
fn search_files(workspace_root: String, query: String) -> Result<Vec<SearchResult>, String> {
    let trimmed_query = query.trim().to_string();
    if trimmed_query.is_empty() {
        return Ok(Vec::new());
    }
    let root = PathBuf::from(&workspace_root)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if let Ok(results) = search_files_with_index(&root, &trimmed_query) {
        return Ok(results);
    }
    let mut results = Vec::new();
    collect_search_results(&root, &root, &trimmed_query.to_lowercase(), &mut results)?;
    Ok(results)
}

fn search_files_with_index(root: &Path, query: &str) -> Result<Vec<SearchResult>, String> {
    let search_db_path = search_database_path(root);
    if !search_db_path.is_file() {
        rebuild_search_index(root)?;
    }
    let connection = Connection::open(&search_db_path).map_err(|error| error.to_string())?;
    if search_index_needs_rebuild(&connection)? {
        drop(connection);
        rebuild_search_index(root)?;
    }
    let connection = Connection::open(&search_db_path).map_err(|error| error.to_string())?;
    let fts_query = build_fts_query(query);
    if fts_query.is_empty() {
        return Ok(Vec::new());
    }
    let mut statement = connection
        .prepare(
            "SELECT file_path, snippet(search_index, 2, '', '', '...', 18)
             FROM search_index
             WHERE search_index MATCH ?1
             LIMIT 20",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![fts_query], |row| {
            Ok(SearchResult {
                file_path: row.get(0)?,
                preview: row.get(1)?,
            })
        })
        .map_err(|error| error.to_string())?;
    let root_string = root.to_string_lossy().to_string();
    let mut results = Vec::new();
    for row in rows {
        let result = row.map_err(|error| error.to_string())?;
        if resolve_workspace_path(&root_string, &result.file_path).is_ok() {
            results.push(result);
        }
    }
    Ok(results)
}

fn search_index_needs_rebuild(connection: &Connection) -> Result<bool, String> {
    let count: i64 = connection
        .query_row("SELECT count(*) FROM search_index LIMIT 1", [], |row| {
            row.get(0)
        })
        .map_err(|error| error.to_string())?;
    Ok(count == 0)
}

fn build_fts_query(query: &str) -> String {
    query
        .split_whitespace()
        .map(|token| format!("\"{}\"", token.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" AND ")
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
    let root = PathBuf::from(&workspace_root)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    rebuild_search_index(&root)?;
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
    // Resolve symlinks before the containment check.
    // For existing paths, canonicalize resolves all symlink components.
    // For non-existent paths (new files), canonicalize the parent directory —
    // a symlinked parent would otherwise pass the starts_with check undetected.
    let comparable_path = if target_path.exists() {
        target_path.canonicalize().map_err(|e| e.to_string())?
    } else {
        let parent = target_path
            .parent()
            .ok_or_else(|| "invalid path: no parent".to_string())?;
        let file_name = target_path
            .file_name()
            .ok_or_else(|| "invalid path: no file name".to_string())?;
        let canonical_parent = parent
            .canonicalize()
            .unwrap_or_else(|_| parent.to_path_buf());
        canonical_parent.join(file_name)
    };
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

// ── Provider / Chat commands ────────────────────────────────────────────────

/// BR-AG-SEC-001: Allowlist of accepted provider identifiers for API key storage.
/// Prevents path traversal via crafted provider strings (e.g. "../../etc/passwd").
const ALLOWED_PROVIDERS: &[&str] = &["anthropic", "openai", "deepseek"];

fn validate_provider(provider: &str) -> Result<String, String> {
    let lower = provider.to_lowercase();
    if ALLOWED_PROVIDERS.contains(&lower.as_str()) {
        Ok(lower)
    } else {
        Err(format!("unknown provider: {}", provider))
    }
}

fn provider_key_path(app: &tauri::AppHandle, provider: &str) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    Ok(config_dir.join("credentials").join(format!("{}.key", provider)))
}

fn save_provider_api_key(app: &tauri::AppHandle, provider: &str, api_key: &str) -> Result<(), String> {
    let key_path = provider_key_path(app, provider)?;
    if let Some(parent) = key_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(&key_path, api_key.trim().as_bytes()).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        let permissions = std::os::unix::fs::PermissionsExt::from_mode(0o600);
        fs::set_permissions(&key_path, permissions).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn load_provider_api_key(app: &tauri::AppHandle, provider: &str) -> Result<Option<String>, String> {
    let key_path = provider_key_path(app, provider)?;
    if !key_path.is_file() {
        return Ok(None);
    }
    let key = fs::read_to_string(&key_path).map_err(|error| error.to_string())?;
    let trimmed = key.trim().to_string();
    if trimmed.is_empty() {
        Ok(None)
    } else {
        Ok(Some(trimmed))
    }
}

/// BR-AG-SEC-001 / BR-AG-PERSIST-002: API key is stored only in a Rust-side
/// provider allowlisted local credential file with 0600 permissions.
/// Raw key never crosses the IPC boundary back to TypeScript.
#[tauri::command]
fn save_api_key(app: tauri::AppHandle, provider: String, api_key: String) -> Result<(), String> {
    let provider_key = validate_provider(&provider)?;
    save_provider_api_key(&app, &provider_key, &api_key)
}

/// BR-AG-SEC-001 / BR-AG-PERSIST-002: Returns only a boolean; raw key never returned.
#[tauri::command]
fn is_api_key_configured(app: tauri::AppHandle, provider: String) -> Result<bool, String> {
    let provider_key = validate_provider(&provider)?;
    Ok(load_provider_api_key(&app, &provider_key)?.is_some())
}

fn load_api_key(app: &tauri::AppHandle, provider: &str) -> Result<String, String> {
    let provider_key = validate_provider(provider)?;
    let key = load_provider_api_key(app, &provider_key)?;
    let Some(key) = key else {
        return Err("API key not configured".to_string());
    };
    let trimmed = key.trim().to_string();
    if trimmed.is_empty() {
        return Err("API key not configured".to_string());
    }
    Ok(trimmed)
}

#[derive(Clone)]
struct PromptRuntimeContext {
    workspace_root: String,
    turn_intent: String,
    active_file_path: Option<String>,
    active_file_mode: Option<String>,
    active_file_dirty: Option<bool>,
    pending_diff_count: Option<u32>,
    active_file_visible_text: Option<String>,
    active_file_logical_state_snapshot: Option<String>,
    active_file_snapshot_truncated: Option<bool>,
    /// Pre-built XML string from extractDocumentStructure() on the frontend.
    /// Injected as L0 ④ in system prompt for .md files (AG-M-P-02 §3 ④).
    document_structure: Option<String>,
    input_references: Vec<InputReferencePayload>,
}

#[derive(Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
#[allow(dead_code)]
enum InputReferencePayload {
    Text {
        id: String,
        content: String,
        display_name: String,
        created_at: u64,
    },
    Url {
        id: String,
        url: String,
        display_name: String,
        created_at: u64,
    },
}

fn workspace_name(workspace_root: &str) -> String {
    Path::new(workspace_root)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Workspace")
        .to_string()
}

fn allowed_tool_names(runtime: &PromptRuntimeContext) -> Vec<&'static str> {
    let mut tools = vec!["read_file", "list_files", "search_files"];
    if runtime.active_file_path.is_some()
        && runtime.active_file_mode.as_deref() == Some("editable")
        && runtime.active_file_logical_state_snapshot.is_some()
    {
        tools.push("edit_current_editor_document");
    }
    tools
}

fn cdata_safe(content: &str) -> String {
    content.replace("]]>", "]]]]><![CDATA[>")
}

fn xml_attr_safe(content: &str) -> String {
    content
        .replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn truncate_reference_content(content: &str, remaining_budget: &mut usize) -> String {
    if *remaining_budget == 0 {
        return "[内容已截断]".to_string();
    }
    let char_count = content.chars().count();
    let take_count = char_count.min(8_000).min(*remaining_budget);
    *remaining_budget = (*remaining_budget).saturating_sub(take_count);
    let mut result: String = content.chars().take(take_count).collect();
    if take_count < char_count {
        result.push_str("[内容已截断]");
    }
    result
}

fn build_input_references_xml(references: &[InputReferencePayload]) -> Option<String> {
    if references.is_empty() {
        return None;
    }

    let mut remaining_budget = 20_000usize;
    let mut lines = vec!["<input_references>".to_string()];

    for reference in references {
        match reference {
            InputReferencePayload::Text { display_name, content, .. } => {
                let truncated = truncate_reference_content(content, &mut remaining_budget);
                lines.push(format!(
                    "<reference kind=\"text\" name=\"{}\">",
                    xml_attr_safe(display_name)
                ));
                lines.push("<![CDATA[".to_string());
                lines.push(cdata_safe(&truncated));
                lines.push("]]>".to_string());
                lines.push("</reference>".to_string());
            }
            InputReferencePayload::Url { display_name, url, .. } => {
                lines.push(format!(
                    "<reference kind=\"url\" name=\"{}\">",
                    xml_attr_safe(display_name)
                ));
                lines.push(xml_attr_safe(url));
                lines.push("</reference>".to_string());
            }
        }
    }

    lines.push("</input_references>".to_string());
    lines.push("InputReference gate: references are context only. Do not use reference content as originalText or as an execution anchor; edits must still go through Diff Review.".to_string());
    Some(lines.join("\n"))
}

fn build_system_prompt(runtime: &PromptRuntimeContext) -> String {
    let mut lines = vec![
        "You are a coding assistant for the Binder Mini workspace editor.".to_string(),
        format!("Current workspace: {}", workspace_name(&runtime.workspace_root)),
        "Use workspace tools to inspect files instead of guessing project content.".to_string(),
    ];
    lines.push("Prompt architecture:".to_string());
    lines.push(format!("- Current turn interpretation mode: {}", runtime.turn_intent));
    lines.push("- The current_turn block in the user message is the only active instruction for this response.".to_string());
    lines.push("- conversation_history is memory, not an instruction list.".to_string());
    lines.push("- You may use conversation_history to answer questions about the dialogue or resolve references in current_turn.".to_string());
    lines.push("- Do not continue, execute, or infer tasks from conversation_history unless current_turn explicitly asks to continue or use prior work.".to_string());
    lines.push("- If current_turn is casual conversation, answer casually and do not inspect or describe the active document.".to_string());

    if let Some(active_file) = &runtime.active_file_path {
        let mode = runtime.active_file_mode.as_deref().unwrap_or("unknown");
        let dirty = if runtime.active_file_dirty.unwrap_or(false) { "dirty" } else { "clean" };
        let pending = runtime.pending_diff_count.unwrap_or(0);
        lines.push(format!(
            "Active file: {} [{}] [{}] [{} pending diffs]",
            active_file, mode, dirty, pending
        ));
    } else {
        lines.push("Active file: none".to_string());
    }

    lines.push("Runtime authority:".to_string());
    lines.push("- current_editor_document is the only authoritative source for the current ActiveFile.".to_string());
    lines.push("- conversation history is prior dialogue only; it is not evidence of current document content.".to_string());
    lines.push("- If prior dialogue conflicts with current_editor_document, current_editor_document wins.".to_string());
    lines.push("- When the user asks what the current document is or what you can see, answer from visible_text.".to_string());
    lines.push("- Do not emit raw Markdown syntax when answering about visible content unless the user asks for Markdown/source.".to_string());
    lines.push("- Use markdown_source only when the user explicitly asks for Markdown/source text or when preparing an edit.".to_string());
    lines.push("- Do not infer current document content from previous assistant messages.".to_string());

    if let Some(active_file) = &runtime.active_file_path {
        let dirty = if runtime.active_file_dirty.unwrap_or(false) { "true" } else { "false" };
        let truncated = if runtime.active_file_snapshot_truncated.unwrap_or(false) { "true" } else { "false" };
        let format = if active_file.to_lowercase().ends_with(".md") { "markdown" } else { "text" };
        lines.push(format!(
            "<current_editor_document authoritative=\"true\" file=\"{}\" dirty=\"{}\" truncated=\"{}\" format=\"{}\">",
            xml_attr_safe(active_file), dirty, truncated, format
        ));
        if let Some(visible_text) = &runtime.active_file_visible_text {
            lines.push("<visible_text><![CDATA[".to_string());
            lines.push(cdata_safe(visible_text));
            lines.push("]]></visible_text>".to_string());
        }
        if let Some(snapshot) = &runtime.active_file_logical_state_snapshot {
            lines.push("<markdown_source><![CDATA[".to_string());
            lines.push(cdata_safe(snapshot));
            lines.push("]]></markdown_source>".to_string());
        }
        if let Some(doc_structure) = &runtime.document_structure {
            if !doc_structure.trim().is_empty() {
                lines.push(doc_structure.clone());
            }
        }
        lines.push("</current_editor_document>".to_string());
    }

    if let Some(input_references_xml) = build_input_references_xml(&runtime.input_references) {
        lines.push(input_references_xml);
    }

    lines.push("Tool constraints:".to_string());
    lines.push("- read_file/list_files/search_files inspect files inside the current Workspace boundary from DiskState. Use them only when current_turn requires workspace inspection.".to_string());
    lines.push("- edit_current_editor_document targets the runtime ActiveFile only; ignore any model-supplied filePath as execution authority. Use it only when current_turn clearly requests an edit.".to_string());
    lines.push("- CRITICAL — originalText must be PLAIN TEXT only. The editor stores content as plain text nodes; Markdown syntax characters are structural markers and are NOT stored as text.".to_string());
    lines.push("  Strip ALL Markdown syntax from originalText: heading markers (#), bold/italic markers (**, *, _), list markers (-, *, +, numbers), code fences (```), blockquote (>), etc.".to_string());
    lines.push("  Examples: '# Welcome' → originalText='Welcome'  |  '**important**' → originalText='important'  |  '- list item' → originalText='list item'".to_string());
    lines.push("  The current_editor_document markdown_source shows Markdown formatting so you can understand document structure and style context. Do NOT copy those syntax characters into originalText.".to_string());
    lines.push("- For ActiveFile edits, extract originalText from current_editor_document visible_text/document_structure after stripping Markdown syntax. Do not use read_file/DiskState as the edit source.".to_string());
    lines.push("- newText is the plain text replacement. Provide only the text content; do not wrap with Markdown syntax characters.".to_string());
    lines.push("- Do not replace the whole file. Always provide a precise originalText fragment.".to_string());
    lines.push("- API keys, absolute system paths, and internal credential storage are never available to the model.".to_string());

    lines.join("\n")
}

fn anthropic_tools(runtime: &PromptRuntimeContext) -> Vec<serde_json::Value> {
    let mut tools = Vec::new();
    for name in allowed_tool_names(runtime) {
        match name {
            "read_file" => tools.push(serde_json::json!({
                "name": "read_file",
                "description": "Read a text file inside the current Workspace.",
                "input_schema": {
                    "type": "object",
                    "properties": { "filePath": { "type": "string", "description": "Workspace-relative file path." } },
                    "required": ["filePath"]
                }
            })),
            "list_files" => tools.push(serde_json::json!({
                "name": "list_files",
                "description": "List files and folders inside a Workspace directory.",
                "input_schema": {
                    "type": "object",
                    "properties": { "dirPath": { "type": "string", "description": "Workspace-relative directory path. Empty means Workspace root." } }
                }
            })),
            "search_files" => tools.push(serde_json::json!({
                "name": "search_files",
                "description": "Search text files inside the current Workspace.",
                "input_schema": {
                    "type": "object",
                    "properties": { "query": { "type": "string", "description": "Search query." } },
                    "required": ["query"]
                }
            })),
            "edit_current_editor_document" => tools.push(serde_json::json!({
                "name": "edit_current_editor_document",
                "description": "Precisely replace a plain-text fragment in the runtime ActiveFile. The target file is determined by Binder Mini runtime, not by tool arguments. IMPORTANT: originalText and newText must be plain text — strip all Markdown syntax characters (# * ** _ - ` > etc.) before using as originalText.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "originalText": {
                            "type": "string",
                            "description": "Exact plain-text fragment to find and replace. Must NOT contain Markdown syntax characters. Extract from current_editor_document visible_text/document_structure. Example: for '# Hello World' use 'Hello World', not '# Hello World'."
                        },
                        "newText": {
                            "type": "string",
                            "description": "Plain-text replacement fragment (not the whole file). Must NOT contain Markdown syntax characters."
                        },
                        "summary": {
                            "type": "string",
                            "description": "Short human-readable description of this edit."
                        },
                        "startBlockId": {
                            "type": "string",
                            "description": "Optional. The block-id of the block containing originalText, from <document_structure>. Helps disambiguate when originalText appears multiple times."
                        },
                        "startOffset": {
                            "type": "integer",
                            "description": "Optional. Character offset of originalText within the block's plain text (0-based, no Markdown syntax chars). Use together with startBlockId."
                        },
                        "occurrenceIndex": {
                            "type": "integer",
                            "description": "Optional. 0-based index of which occurrence to replace when originalText appears multiple times in the document. Default: 0 (first occurrence)."
                        }
                    },
                    "required": ["originalText", "newText", "summary"]
                }
            })),
            _ => {}
        }
    }
    tools
}

fn openai_tools(runtime: &PromptRuntimeContext) -> Vec<serde_json::Value> {
    anthropic_tools(runtime)
        .into_iter()
        .filter_map(|tool| {
            Some(serde_json::json!({
                "type": "function",
                "function": {
                    "name": tool["name"].as_str()?,
                    "description": tool["description"].as_str().unwrap_or(""),
                    "parameters": tool["input_schema"].clone()
                }
            }))
        })
        .collect()
}

#[derive(Clone, Serialize)]
struct ToolCallPayload {
    id: String,
    name: String,
    input_json: String,
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum ChatStreamEvent {
    Token { request_id: String, token: String },
    /// BR-AG-DATA-002: emitted when Anthropic returns a tool_use block.
    /// TypeScript executes the tool and sends the result back as role="tool" in the same turn.
    ToolCall {
        request_id: String,
        /// Anthropic-assigned tool_use id; must equal ToolResult.callId (BR-AG-DATA-002).
        id: String,
        name: String,
        /// Fully-accumulated JSON string of the tool input.
        /// Explicit rename overrides enum-level rename_all="camelCase" so TypeScript
        /// receives "input_json" (matching ChatStreamEvent type) not "inputJson".
        #[serde(rename = "input_json")]
        input_json: String,
    },
    ToolCalls { request_id: String, calls: Vec<ToolCallPayload> },
    Done { request_id: String },
    Failed { request_id: String, message: String },
}

/// BR-AG-DATA-002: message payload from TypeScript.
/// role="tool" messages carry toolCallId and are converted to Anthropic tool_result format.
/// role="assistant" messages with toolCallId have content as a JSON array of tool_use blocks.
#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ChatMessagePayload {
    role: String,
    content: String,
    /// Anthropic tool_use id; present on role="tool" and role="assistant" tool_use messages.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    tool_call_id: Option<String>,
}

fn emit_tool_calls(app: &tauri::AppHandle, request_id: &str, calls: Vec<ToolCallPayload>) {
    if calls.len() == 1 {
        let call = calls.into_iter().next().unwrap();
        let _ = app.emit(
            "chat-stream-event",
            ChatStreamEvent::ToolCall {
                request_id: request_id.to_string(),
                id: call.id,
                name: call.name,
                input_json: call.input_json,
            },
        );
    } else {
        let _ = app.emit(
            "chat-stream-event",
            ChatStreamEvent::ToolCalls {
                request_id: request_id.to_string(),
                calls,
            },
        );
    }
}

/// BR-AG-STATE-002: SSE stream from selected provider.
/// Emits "chat-stream-event" Tauri events for each token, done, or failure.
/// BR-AG-SEC-001: API key loaded from Rust-side credential storage, never passed from TypeScript.
/// BR-AG-STATE-003: model is validated against supported set before request.
#[tauri::command]
async fn chat_stream(
    app: tauri::AppHandle,
    request_id: String,
    workspace_root: String,
    messages: Vec<ChatMessagePayload>,
    provider_type: String,
    model: String,
    active_file_path: Option<String>,
    active_file_mode: Option<String>,
    active_file_dirty: Option<bool>,
    pending_diff_count: Option<u32>,
    turn_intent: Option<String>,
    active_file_visible_text: Option<String>,
    active_file_logical_state_snapshot: Option<String>,
    active_file_snapshot_truncated: Option<bool>,
    document_structure: Option<String>,
    input_references: Vec<InputReferencePayload>,
) -> Result<(), String> {
    let runtime = PromptRuntimeContext {
        workspace_root,
        turn_intent: turn_intent.unwrap_or_else(|| "model_judged".to_string()),
        active_file_path,
        active_file_mode,
        active_file_dirty,
        pending_diff_count,
        active_file_visible_text,
        active_file_logical_state_snapshot,
        active_file_snapshot_truncated,
        document_structure,
        input_references,
    };
    chat_debug_log(&app, &format!(
        "[chat_stream] start request_id={} provider={} model={} messages={} active_file={}",
        request_id,
        provider_type,
        model,
        messages.len(),
        runtime.active_file_path.as_deref().unwrap_or("none")
    ));
    let provider_key = match validate_provider(&provider_type) {
        Ok(provider) => provider,
        Err(e) => {
            chat_debug_error(&app, &format!("[chat_stream] provider invalid request_id={} error={}", request_id, e));
            let _ = app.emit("chat-stream-event", ChatStreamEvent::Failed { request_id, message: e });
            return Ok(());
        }
    };

    // Load key — if missing emit Failed and return
    let api_key = match load_api_key(&app, &provider_key) {
        Ok(k) => k,
        Err(e) => {
            chat_debug_error(&app, &format!("[chat_stream] api key missing request_id={} provider={}", request_id, provider_key));
            let _ = app.emit("chat-stream-event", ChatStreamEvent::Failed { request_id, message: e });
            return Ok(());
        }
    };

    match provider_key.as_str() {
        "anthropic" => anthropic_chat_stream(app, request_id, api_key, messages, model, runtime).await,
        "openai" => {
            openai_compatible_chat_stream(
                app,
                request_id,
                api_key,
                messages,
                model,
                "https://api.openai.com/v1/chat/completions",
                runtime,
            )
            .await
        }
        "deepseek" => {
            openai_compatible_chat_stream(
                app,
                request_id,
                api_key,
                messages,
                model,
                "https://api.deepseek.com/chat/completions",
                runtime,
            )
            .await
        }
        _ => Ok(()),
    }
}

async fn anthropic_chat_stream(
    app: tauri::AppHandle,
    request_id: String,
    api_key: String,
    messages: Vec<ChatMessagePayload>,
    model: String,
    runtime: PromptRuntimeContext,
) -> Result<(), String> {
    // Convert messages to Anthropic API format.
    // BR-AG-DATA-002: role="tool" → Anthropic tool_result (role="user" with content array).
    // role="assistant" with tool_call_id → content is JSON array of tool_use blocks.
    // System messages are excluded from history; PromptRuntime L0 is sent via Anthropic system.
    let filtered_messages: Vec<&ChatMessagePayload> = messages
        .iter()
        .filter(|m| m.role == "user" || m.role == "assistant" || m.role == "tool")
        .collect();
    let mut api_messages: Vec<serde_json::Value> = Vec::new();
    let mut idx = 0;
    while idx < filtered_messages.len() {
        let m = filtered_messages[idx];
        if m.role == "tool" {
            let mut blocks: Vec<serde_json::Value> = Vec::new();
            while idx < filtered_messages.len() && filtered_messages[idx].role == "tool" {
                let tool_msg = filtered_messages[idx];
                let tool_use_id = tool_msg.tool_call_id.as_deref().unwrap_or("");
                blocks.push(serde_json::json!({
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": tool_msg.content
                }));
                idx += 1;
            }
            api_messages.push(serde_json::json!({ "role": "user", "content": blocks }));
            continue;
        }

        if m.role == "assistant" && m.tool_call_id.is_some() {
            let blocks: serde_json::Value = serde_json::from_str(&m.content)
                .unwrap_or_else(|_| serde_json::json!([]));
            api_messages.push(serde_json::json!({ "role": "assistant", "content": blocks }));
        } else {
            api_messages.push(serde_json::json!({ "role": m.role, "content": m.content }));
        }
        idx += 1;
    }

    if api_messages.is_empty() {
        let _ = app.emit(
            "chat-stream-event",
            ChatStreamEvent::Failed {
                request_id: request_id.clone(),
                message: "No user/assistant messages to send".to_string(),
            },
        );
        return Ok(());
    }

    let system_prompt = build_system_prompt(&runtime);
    let message_count = api_messages.len();
    let tools = anthropic_tools(&runtime);
    let tool_count = tools.len();
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 8192,
        "stream": true,
        "system": system_prompt,
        "tools": tools,
        "messages": api_messages
    });

    if prompt_debug_enabled() {
        chat_debug_log(&app, &format!(
            "\n╔══ PROMPT SYSTEM [anthropic] request_id={} model={} active_file={} ══╗\n{}\n╚══ END PROMPT SYSTEM ══╝",
            request_id,
            model,
            runtime.active_file_path.as_deref().unwrap_or("none"),
            system_prompt
        ));
        chat_debug_log(&app, &format!(
            "\n╔══ PROMPT BUILD [anthropic] request_id={} model={} ══╗\n{}\n╚══ END PROMPT BUILD ══╝",
            request_id,
            model,
            serde_json::to_string_pretty(&body).unwrap_or_else(|e| format!("<serialize error: {e}>"))
        ));
    } else {
        chat_debug_log(&app, &format!(
            "[chat_stream] prompt metadata provider=anthropic request_id={} model={} active_file={} messages={} tools={}",
            request_id,
            model,
            runtime.active_file_path.as_deref().unwrap_or("none"),
            message_count,
            tool_count
        ));
    }

    let client = reqwest::Client::new();
    let response = match client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            let _ = app.emit(
                "chat-stream-event",
                ChatStreamEvent::Failed {
                    request_id: request_id.clone(),
                    message: e.to_string(),
                },
            );
            return Ok(());
        }
    };

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body_text = response.text().await.unwrap_or_default();
        let _ = app.emit(
            "chat-stream-event",
            ChatStreamEvent::Failed {
                request_id: request_id.clone(),
                message: format!("HTTP {}: {}", status, body_text),
            },
        );
        return Ok(());
    }

    // Parse SSE line-by-line.
    // Tracks in-progress tool_use block: when Anthropic returns a tool_use content block,
    // we accumulate its input_json across multiple input_json_delta events, then on
    // message_stop emit a ToolCall event (BR-AG-DATA-002) instead of Done.
    let mut byte_stream = response.bytes_stream();
    let mut line_buffer = String::new();

    // Tool-use accumulation state. Anthropic can return multiple tool_use blocks
    // in one assistant message; keep each block instead of overwriting earlier ones.
    let mut pending_tools: Vec<ToolCallPayload> = Vec::new();
    let mut active_tool_index: Option<usize> = None;

    while let Some(chunk) = byte_stream.next().await {
        let chunk = match chunk {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit(
                    "chat-stream-event",
                    ChatStreamEvent::Failed {
                        request_id: request_id.clone(),
                        message: e.to_string(),
                    },
                );
                return Ok(());
            }
        };

        line_buffer.push_str(&String::from_utf8_lossy(&chunk));

        loop {
            let Some(newline_pos) = line_buffer.find('\n') else {
                break;
            };
            let raw_line = line_buffer[..newline_pos]
                .trim_end_matches('\r')
                .to_string();
            line_buffer.drain(..=newline_pos);

            if !raw_line.starts_with("data: ") {
                continue;
            }
            let data = &raw_line[6..];
            if data == "[DONE]" {
                let _ = app.emit(
                    "chat-stream-event",
                    ChatStreamEvent::Done { request_id: request_id.clone() },
                );
                return Ok(());
            }

            let Ok(json) = serde_json::from_str::<serde_json::Value>(data) else {
                continue;
            };

            match json["type"].as_str() {
                // Text token from assistant text block.
                Some("content_block_delta") => {
                    let delta_type = json["delta"]["type"].as_str().unwrap_or("");
                    if delta_type == "text_delta" {
                        if let Some(text) = json["delta"]["text"].as_str() {
                            let _ = app.emit(
                                "chat-stream-event",
                                ChatStreamEvent::Token {
                                    request_id: request_id.clone(),
                                    token: text.to_string(),
                                },
                            );
                        }
                    } else if delta_type == "input_json_delta" {
                        // BR-AG-DATA-002: accumulate tool input JSON.
                        if let Some(partial) = json["delta"]["partial_json"].as_str() {
                            if let Some(tool_index) = active_tool_index {
                                if let Some(tool) = pending_tools.get_mut(tool_index) {
                                    tool.input_json.push_str(partial);
                                }
                            }
                        }
                    }
                }
                // Start of a new content block. If it is a tool_use block, record id + name.
                Some("content_block_start") => {
                    let block = &json["content_block"];
                    if block["type"].as_str() == Some("tool_use") {
                        pending_tools.push(ToolCallPayload {
                            id: block["id"].as_str().unwrap_or("").to_string(),
                            name: block["name"].as_str().unwrap_or("").to_string(),
                            input_json: String::new(),
                        });
                        active_tool_index = Some(pending_tools.len() - 1);
                    } else {
                        active_tool_index = None;
                    }
                }
                // message_stop: if we accumulated a tool_use block, emit ToolCall;
                // otherwise emit Done.
                Some("message_stop") => {
                    if !pending_tools.is_empty() {
                        let calls = std::mem::take(&mut pending_tools);
                        emit_tool_calls(&app, &request_id, calls);
                    } else {
                        let _ = app.emit(
                            "chat-stream-event",
                            ChatStreamEvent::Done { request_id: request_id.clone() },
                        );
                    }
                    return Ok(());
                }
                _ => {}
            }
        }
    }

    // Stream ended without explicit stop.
    let _ = app.emit("chat-stream-event", ChatStreamEvent::Done { request_id });
    Ok(())
}

fn openai_compatible_messages(messages: &[ChatMessagePayload]) -> Vec<serde_json::Value> {
    let mut api_messages: Vec<serde_json::Value> = Vec::new();
    let mut pending_tool_call_ids: Vec<String> = Vec::new();

    for m in messages {
        if m.role == "tool" {
            let tool_call_id = m.tool_call_id.as_deref().unwrap_or("");
            if !tool_call_id.is_empty() && pending_tool_call_ids.iter().any(|id| id == tool_call_id) {
                api_messages.push(serde_json::json!({
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "content": m.content
                }));
                pending_tool_call_ids.retain(|id| id != tool_call_id);
            }
            continue;
        }

        if m.role == "assistant" && m.tool_call_id.is_some() {
            let blocks: serde_json::Value = serde_json::from_str(&m.content)
                .unwrap_or_else(|_| serde_json::json!([]));
            let mut content_parts: Vec<String> = Vec::new();
            let mut tool_calls: Vec<serde_json::Value> = Vec::new();
            if let Some(items) = blocks.as_array() {
                for item in items {
                    match item["type"].as_str() {
                        Some("text") => {
                            if let Some(text) = item["text"].as_str() {
                                content_parts.push(text.to_string());
                            }
                        }
                        Some("tool_use") => {
                            let id = item["id"].as_str().unwrap_or("");
                            let name = item["name"].as_str().unwrap_or("");
                            if id.is_empty() || name.is_empty() {
                                continue;
                            }
                            let arguments = serde_json::to_string(
                                item.get("input").unwrap_or(&serde_json::Value::Null),
                            )
                            .unwrap_or_else(|_| "{}".to_string());
                            tool_calls.push(serde_json::json!({
                                "id": id,
                                "type": "function",
                                "function": {
                                    "name": name,
                                    "arguments": arguments
                                }
                            }));
                        }
                        _ => {}
                    }
                }
            }
            let content_text = content_parts.join("");
            if tool_calls.is_empty() {
                if !content_text.trim().is_empty() {
                    api_messages.push(serde_json::json!({
                        "role": "assistant",
                        "content": content_text
                    }));
                }
                pending_tool_call_ids.clear();
            } else {
                pending_tool_call_ids = tool_calls
                    .iter()
                    .filter_map(|call| call["id"].as_str().map(|id| id.to_string()))
                    .collect();
                let content = if content_text.trim().is_empty() {
                    serde_json::Value::Null
                } else {
                    serde_json::Value::String(content_text)
                };
                api_messages.push(serde_json::json!({
                    "role": "assistant",
                    "content": content,
                    "tool_calls": tool_calls
                }));
            }
            continue;
        }

        if m.role == "system" {
            continue;
        }

        if m.role == "user" || m.role == "assistant" {
            if m.role == "assistant" && m.content.trim().is_empty() {
                pending_tool_call_ids.clear();
                continue;
            }
            pending_tool_call_ids.clear();
            api_messages.push(serde_json::json!({ "role": m.role, "content": m.content }));
        }
    }

    api_messages
}

async fn openai_compatible_chat_stream(
    app: tauri::AppHandle,
    request_id: String,
    api_key: String,
    messages: Vec<ChatMessagePayload>,
    model: String,
    endpoint: &str,
    runtime: PromptRuntimeContext,
) -> Result<(), String> {
    let mut api_messages = openai_compatible_messages(&messages);
    let system_prompt = build_system_prompt(&runtime);
    api_messages.insert(0, serde_json::json!({
        "role": "system",
        "content": system_prompt
    }));
    if api_messages.is_empty() {
        chat_debug_error(&app, &format!(
            "[chat_stream] openai-compatible empty messages request_id={} endpoint={}",
            request_id,
            endpoint
        ));
        let _ = app.emit(
            "chat-stream-event",
            ChatStreamEvent::Failed {
                request_id: request_id.clone(),
                message: "No messages to send".to_string(),
            },
        );
        return Ok(());
    }

    let message_count = api_messages.len();
    let tools = openai_tools(&runtime);
    let tool_count = tools.len();
    let body = serde_json::json!({
        "model": model,
        "stream": true,
        "tools": tools,
        "messages": api_messages
    });

    if prompt_debug_enabled() {
        chat_debug_log(&app, &format!(
            "\n╔══ PROMPT SYSTEM [openai-compat] request_id={} endpoint={} model={} active_file={} ══╗\n{}\n╚══ END PROMPT SYSTEM ══╝",
            request_id,
            endpoint,
            model,
            runtime.active_file_path.as_deref().unwrap_or("none"),
            system_prompt
        ));
        chat_debug_log(&app, &format!(
            "\n╔══ PROMPT BUILD [openai-compat] request_id={} endpoint={} model={} ══╗\n{}\n╚══ END PROMPT BUILD ══╝",
            request_id,
            endpoint,
            model,
            serde_json::to_string_pretty(&body).unwrap_or_else(|e| format!("<serialize error: {e}>"))
        ));
    } else {
        chat_debug_log(&app, &format!(
            "[chat_stream] prompt metadata provider=openai-compatible request_id={} endpoint={} model={} active_file={} messages={} tools={}",
            request_id,
            endpoint,
            model,
            runtime.active_file_path.as_deref().unwrap_or("none"),
            message_count,
            tool_count
        ));
    }

    let client = reqwest::Client::new();
    let response = match client
        .post(endpoint)
        .bearer_auth(&api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            chat_debug_error(&app, &format!("[chat_stream] openai-compatible request error request_id={} error={}", request_id, e));
            let _ = app.emit(
                "chat-stream-event",
                ChatStreamEvent::Failed {
                    request_id: request_id.clone(),
                    message: e.to_string(),
                },
            );
            return Ok(());
        }
    };

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body_text = response.text().await.unwrap_or_default();
        chat_debug_error(&app, &format!(
            "[chat_stream] openai-compatible http error request_id={} status={} body={}",
            request_id,
            status,
            body_text
        ));
        let _ = app.emit(
            "chat-stream-event",
            ChatStreamEvent::Failed {
                request_id: request_id.clone(),
                message: format!("HTTP {}: {}", status, body_text),
            },
        );
        return Ok(());
    }

    let mut byte_stream = response.bytes_stream();
    let mut line_buffer = String::new();
    let mut pending_tools: Vec<ToolCallPayload> = Vec::new();

    while let Some(chunk) = byte_stream.next().await {
        let chunk = match chunk {
            Ok(c) => c,
            Err(e) => {
                chat_debug_error(&app, &format!("[chat_stream] openai-compatible stream error request_id={} error={}", request_id, e));
                let _ = app.emit(
                    "chat-stream-event",
                    ChatStreamEvent::Failed {
                        request_id: request_id.clone(),
                        message: e.to_string(),
                    },
                );
                return Ok(());
            }
        };

        line_buffer.push_str(&String::from_utf8_lossy(&chunk));
        loop {
            let Some(newline_pos) = line_buffer.find('\n') else {
                break;
            };
            let raw_line = line_buffer[..newline_pos]
                .trim_end_matches('\r')
                .to_string();
            line_buffer.drain(..=newline_pos);

            if !raw_line.starts_with("data: ") {
                continue;
            }
            let data = &raw_line[6..];
            if data == "[DONE]" {
                if pending_tools.is_empty() {
                    chat_debug_log(&app, &format!("[chat_stream] openai-compatible done request_id={}", request_id));
                    let _ = app.emit(
                        "chat-stream-event",
                        ChatStreamEvent::Done { request_id: request_id.clone() },
                    );
                } else {
                    chat_debug_log(&app, &format!(
                        "[chat_stream] openai-compatible tool_calls request_id={} count={}",
                        request_id,
                        pending_tools.len()
                    ));
                    emit_tool_calls(&app, &request_id, std::mem::take(&mut pending_tools));
                }
                return Ok(());
            }

            let Ok(json) = serde_json::from_str::<serde_json::Value>(data) else {
                continue;
            };
            let Some(choice) = json["choices"].as_array().and_then(|choices| choices.first()) else {
                continue;
            };
            let delta = &choice["delta"];
            if let Some(content) = delta["content"].as_str() {
                let _ = app.emit(
                    "chat-stream-event",
                    ChatStreamEvent::Token {
                        request_id: request_id.clone(),
                        token: content.to_string(),
                    },
                );
            }

            if let Some(tool_calls) = delta["tool_calls"].as_array() {
                for call_delta in tool_calls {
                    let index = call_delta["index"].as_u64().unwrap_or(0) as usize;
                    while pending_tools.len() <= index {
                        pending_tools.push(ToolCallPayload {
                            id: String::new(),
                            name: String::new(),
                            input_json: String::new(),
                        });
                    }
                    if let Some(tool) = pending_tools.get_mut(index) {
                        if let Some(id) = call_delta["id"].as_str() {
                            tool.id = id.to_string();
                        }
                        if let Some(name) = call_delta["function"]["name"].as_str() {
                            tool.name = name.to_string();
                        }
                        if let Some(arguments) = call_delta["function"]["arguments"].as_str() {
                            tool.input_json.push_str(arguments);
                        }
                    }
                }
            }

            if choice["finish_reason"].as_str() == Some("tool_calls") && !pending_tools.is_empty() {
                chat_debug_log(&app, &format!(
                    "[chat_stream] openai-compatible tool_calls request_id={} count={}",
                    request_id,
                    pending_tools.len()
                ));
                emit_tool_calls(&app, &request_id, std::mem::take(&mut pending_tools));
                return Ok(());
            }
        }
    }

    if pending_tools.is_empty() {
        chat_debug_log(&app, &format!("[chat_stream] openai-compatible eof done request_id={}", request_id));
        let _ = app.emit("chat-stream-event", ChatStreamEvent::Done { request_id });
    } else {
        chat_debug_log(&app, &format!(
            "[chat_stream] openai-compatible eof tool_calls request_id={} count={}",
            request_id,
            pending_tools.len()
        ));
        emit_tool_calls(&app, &request_id, pending_tools);
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
        let ws_connection = Connection::open(&metadata.workspace_database_path)
            .expect("workspace database should open as sqlite");
        let business_table_count: i64 = ws_connection
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE name IN
                 ('workspace_settings','pending_diffs','terminal_diff_cards','chat_messages')",
                [],
                |row| row.get(0),
            )
            .expect("business tables should be queryable");
        let search_db_path = search_database_path(&root);
        let search_connection =
            Connection::open(&search_db_path).expect("search database should open");
        let fts_table_count: i64 = search_connection
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE name = 'search_index'",
                [],
                |row| row.get(0),
            )
            .expect("search_index table should be queryable");
        let entries = read_workspace_entries(&root, &root).expect("entries should load");

        assert!(metadata.workspace_database_initialized);
        assert!(PathBuf::from(metadata.workspace_database_path).is_file());
        assert!(search_db_path.is_file());
        assert_eq!(business_table_count, 4);
        assert_eq!(fts_table_count, 1);
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

    #[test]
    fn creates_workspace_file_and_folder_without_leaving_boundary() {
        let root = test_workspace_root("create");
        fs::create_dir_all(root.join("docs")).expect("fixture workspace should be created");
        let root_string = root.to_string_lossy().to_string();

        let folder_result = create_workspace_item(&root_string, "docs/new", "directory")
            .expect("folder should be created");
        let file_result = create_workspace_item(&root_string, "docs/new/readme.md", "file")
            .expect("file should be created");

        assert!(folder_result.success);
        assert!(file_result.success);
        assert!(root.join("docs/new/readme.md").is_file());
        assert!(file_result
            .entries
            .iter()
            .any(|entry| entry.relative_path == "docs"));
        assert!(create_workspace_item(&root_string, "../outside.md", "file").is_err());

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn returns_path_conflict_without_overwriting_existing_target() {
        let root = test_workspace_root("conflict");
        fs::create_dir_all(&root).expect("fixture workspace should be created");
        fs::write(root.join("exists.md"), "original").expect("fixture file should be written");
        let root_string = root.to_string_lossy().to_string();

        let result = create_workspace_item(&root_string, "exists.md", "file")
            .expect("conflict should be returned as mutation result");

        assert!(!result.success);
        let conflict = result.conflict.expect("conflict should be present");
        assert_eq!(conflict.code, "PATH_CONFLICT");
        assert_eq!(conflict.existing_kind, "file");
        assert_eq!(
            fs::read_to_string(root.join("exists.md")).expect("file should remain readable"),
            "original"
        );

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn renames_moves_and_deletes_workspace_items() {
        let root = test_workspace_root("structure");
        fs::create_dir_all(root.join("docs")).expect("fixture workspace should be created");
        fs::create_dir_all(root.join("archive")).expect("fixture workspace should be created");
        fs::write(root.join("docs/readme.md"), "content").expect("fixture file should be written");
        let root_string = root.to_string_lossy().to_string();

        let renamed = rename_workspace_item_impl(&root_string, "docs/readme.md", "notes.md")
            .expect("file should be renamed");
        let moved = move_workspace_item_impl(&root_string, "docs/notes.md", "archive/notes.md")
            .expect("file should be moved");
        let deleted = delete_workspace_item_impl(&root_string, "archive/notes.md")
            .expect("file should be deleted");

        assert!(renamed.success);
        assert!(moved.success);
        assert!(deleted.success);
        assert!(!root.join("archive/notes.md").exists());
        assert!(deleted
            .entries
            .iter()
            .any(|entry| entry.relative_path == "archive"));

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn protects_internal_workspace_data_during_structure_mutations() {
        let root = test_workspace_root("internal");
        fs::create_dir_all(root.join(".binder")).expect("fixture workspace should be created");
        fs::write(root.join(".binder/workspace.db"), "db").expect("fixture file should be written");
        let root_string = root.to_string_lossy().to_string();

        assert!(delete_workspace_item_impl(&root_string, ".binder/workspace.db").is_err());
        assert!(move_workspace_item_impl(&root_string, ".binder/workspace.db", "db").is_err());
        assert!(rename_workspace_item_impl(&root_string, ".binder/workspace.db", "x").is_err());
        assert_eq!(
            fs::read_to_string(root.join(".binder/workspace.db"))
                .expect("internal db should remain readable"),
            "db"
        );

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn move_and_rename_return_path_conflict_without_overwriting() {
        let root = test_workspace_root("move-conflict");
        fs::create_dir_all(&root).expect("fixture workspace should be created");
        fs::write(root.join("a.md"), "a").expect("fixture file should be written");
        fs::write(root.join("b.md"), "b").expect("fixture file should be written");
        let root_string = root.to_string_lossy().to_string();

        let rename_result = rename_workspace_item_impl(&root_string, "a.md", "b.md")
            .expect("rename conflict should be returned");
        let move_result = move_workspace_item_impl(&root_string, "a.md", "b.md")
            .expect("move conflict should be returned");

        assert!(!rename_result.success);
        assert_eq!(
            rename_result
                .conflict
                .expect("rename conflict should exist")
                .code,
            "PATH_CONFLICT"
        );
        assert!(!move_result.success);
        assert_eq!(
            fs::read_to_string(root.join("b.md")).expect("b should remain"),
            "b"
        );
        assert_eq!(
            fs::read_to_string(root.join("a.md")).expect("a should remain"),
            "a"
        );

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn rebuilds_search_index_without_indexing_internal_data() {
        let root = test_workspace_root("search-index");
        fs::create_dir_all(root.join("docs")).expect("fixture workspace should be created");
        fs::create_dir_all(root.join(".binder")).expect("internal dir should be created");
        fs::write(root.join("docs/readme.md"), "Findable needle content")
            .expect("fixture file should be written");
        fs::write(root.join(".binder/secret.md"), "needle internal")
            .expect("internal file should be written");
        initialize_workspace_metadata(&root).expect("metadata should initialize");
        rebuild_search_index(&root).expect("search index should rebuild");

        let root_string = root.to_string_lossy().to_string();
        let results = search_files(root_string, "needle".to_string()).expect("search should run");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file_path, "docs/readme.md");
        assert!(results[0].preview.contains("needle"));

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn write_workspace_file_rebuilds_search_index() {
        let root = test_workspace_root("search-write");
        fs::create_dir_all(&root).expect("fixture workspace should be created");
        fs::write(root.join("notes.md"), "old content").expect("fixture file should be written");
        initialize_workspace_metadata(&root).expect("metadata should initialize");
        rebuild_search_index(&root).expect("search index should rebuild");
        let root_string = root.to_string_lossy().to_string();

        write_workspace_file(
            root_string.clone(),
            "notes.md".to_string(),
            "fresh indexed phrase".to_string(),
        )
        .expect("workspace file should be written");
        let results =
            search_files(root_string, "fresh".to_string()).expect("updated search should run");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file_path, "notes.md");

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    fn make_diff(id: &str, status: &str) -> PendingDiffRecord {
        PendingDiffRecord {
            id: id.to_string(),
            file_path: "notes.md".to_string(),
            original_text: "old".to_string(),
            new_text: "new".to_string(),
            summary: "test".to_string(),
            status: status.to_string(),
            effective_path: "open-file".to_string(),
            source_tool_id: "t1".to_string(),
            base_revision: "rev1".to_string(),
            applied_range_from: None,
            applied_range_to: None,
            created_at: 1_000,
        }
    }

    #[test]
    fn test_save_and_load_pending_diff() {
        let root = test_workspace_root("save-diff");
        fs::create_dir_all(&root).expect("fixture workspace should be created");
        initialize_workspace_metadata(&root).expect("metadata should initialize");
        let root_string = root.to_string_lossy().to_string();

        save_pending_diff(root_string.clone(), make_diff("d1", "pending"))
            .expect("diff should be saved");
        let loaded = load_diffs_from_workspace(root_string).expect("diffs should load");

        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "d1");
        assert_eq!(loaded[0].status, "pending");
        assert_eq!(loaded[0].file_path, "notes.md");
        assert_eq!(loaded[0].base_revision, "rev1");

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn test_update_diff_status() {
        let root = test_workspace_root("update-diff");
        fs::create_dir_all(&root).expect("fixture workspace should be created");
        initialize_workspace_metadata(&root).expect("metadata should initialize");
        let root_string = root.to_string_lossy().to_string();

        save_pending_diff(root_string.clone(), make_diff("d2", "pending"))
            .expect("diff should be saved");
        update_diff_status(root_string.clone(), "d2".to_string(), "expired".to_string())
            .expect("status should update");
        let loaded = load_diffs_from_workspace(root_string).expect("diffs should load");

        // expired is a terminal status; load_diffs_from_workspace excludes it
        assert_eq!(loaded.len(), 0);

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn test_load_excludes_terminal_diffs() {
        let root = test_workspace_root("terminal-diff");
        fs::create_dir_all(&root).expect("fixture workspace should be created");
        initialize_workspace_metadata(&root).expect("metadata should initialize");
        let root_string = root.to_string_lossy().to_string();

        save_pending_diff(root_string.clone(), make_diff("d-accepted", "accepted"))
            .expect("accepted diff should be saved");
        save_pending_diff(root_string.clone(), make_diff("d-rejected", "rejected"))
            .expect("rejected diff should be saved");
        save_pending_diff(root_string.clone(), make_diff("d-pending", "pending"))
            .expect("pending diff should be saved");
        let loaded = load_diffs_from_workspace(root_string).expect("diffs should load");

        // Only the non-terminal diff should be returned
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "d-pending");

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn test_save_terminal_cards_deletes_pending_rows() {
        let root = test_workspace_root("terminal-card");
        fs::create_dir_all(&root).expect("fixture workspace should be created");
        initialize_workspace_metadata(&root).expect("metadata should initialize");
        let root_string = root.to_string_lossy().to_string();

        save_pending_diff(root_string.clone(), make_diff("d-terminal", "pending"))
            .expect("pending diff should be saved");
        save_terminal_cards(
            root_string.clone(),
            vec![TerminalDiffCardRecord {
                diff_id: "d-terminal".to_string(),
                status: "expired".to_string(),
                message: "Diff expired".to_string(),
                source_tool_id: "t1".to_string(),
                resolved_at: 2_000,
            }],
        )
        .expect("terminal card should save");

        let loaded = load_diffs_from_workspace(root_string.clone()).expect("diffs should load");
        assert_eq!(loaded.len(), 0);

        let conn = Connection::open(workspace_database_path(&root)).expect("db should open");
        let terminal_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM terminal_diff_cards WHERE diff_id = 'd-terminal' AND source_tool_id = 't1'",
                [],
                |row| row.get(0),
            )
            .expect("terminal card should be queryable");
        assert_eq!(terminal_count, 1);

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn test_recover_diffs_restores_matching_base_revision_as_pending() {
        let root = test_workspace_root("recover-match");
        fs::create_dir_all(&root).expect("fixture workspace should be created");
        fs::write(root.join("notes.md"), "old").expect("fixture file should be written");
        initialize_workspace_metadata(&root).expect("metadata should initialize");
        let root_string = root.to_string_lossy().to_string();
        let mut diff = make_diff("d-match", "preapplied");
        diff.base_revision = sha256_file_hex(&root.join("notes.md")).expect("hash should compute");
        diff.applied_range_from = Some(1);
        diff.applied_range_to = Some(3);

        save_pending_diff(root_string.clone(), diff).expect("diff should be saved");
        let recovered = recover_diffs_from_workspace(root_string).expect("diffs should recover");

        assert_eq!(recovered.restored.len(), 1);
        assert_eq!(recovered.expired.len(), 0);
        assert_eq!(recovered.restored[0].id, "d-match");
        assert_eq!(recovered.restored[0].status, "pending");
        assert_eq!(recovered.restored[0].effective_path, "closed-file");
        assert_eq!(recovered.restored[0].applied_range_from, None);
        assert_eq!(recovered.restored[0].applied_range_to, None);

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn test_recover_diffs_expires_mismatched_base_revision() {
        let root = test_workspace_root("recover-mismatch");
        fs::create_dir_all(&root).expect("fixture workspace should be created");
        fs::write(root.join("notes.md"), "new content").expect("fixture file should be written");
        initialize_workspace_metadata(&root).expect("metadata should initialize");
        let root_string = root.to_string_lossy().to_string();
        let mut diff = make_diff("d-mismatch", "pending");
        diff.base_revision = "0".repeat(64);

        save_pending_diff(root_string.clone(), diff).expect("diff should be saved");
        let recovered = recover_diffs_from_workspace(root_string.clone()).expect("diffs should recover");

        assert_eq!(recovered.restored.len(), 0);
        assert_eq!(recovered.expired.len(), 1);
        assert_eq!(recovered.expired[0].diff_id, "d-mismatch");
        assert_eq!(recovered.expired[0].status, "expired");
        assert_eq!(
            load_diffs_from_workspace(root_string)
                .expect("diffs should load")
                .len(),
            0,
        );

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn test_save_and_load_chat_messages() {
        let root = test_workspace_root("chat-messages");
        fs::create_dir_all(&root).expect("fixture workspace should be created");
        initialize_workspace_metadata(&root).expect("metadata should initialize");
        let root_string = root.to_string_lossy().to_string();

        let messages = vec![
            ChatMessageRecord {
                id: "m1".to_string(), role: "user".to_string(),
                content: "hello".to_string(), stream_status: None, tool_call_id: None,
                input_references_json: Some("[{\"id\":\"r1\",\"kind\":\"text\",\"content\":\"ref\",\"displayName\":\"Ref\",\"createdAt\":100}]".to_string()),
                active_file_path: None,
                created_at: 1_000, session_id: root_string.clone(),
            },
            ChatMessageRecord {
                id: "m2".to_string(), role: "assistant".to_string(),
                content: "world".to_string(), stream_status: Some("done".to_string()),
                tool_call_id: None, input_references_json: None,
                active_file_path: None,
                created_at: 2_000, session_id: root_string.clone(),
            },
            ChatMessageRecord {
                id: "m3".to_string(), role: "user".to_string(),
                content: "again".to_string(), stream_status: None, tool_call_id: None,
                input_references_json: None,
                active_file_path: None,
                created_at: 3_000, session_id: root_string.clone(),
            },
        ];
        save_chat_messages(root_string.clone(), messages).expect("messages should be saved");
        let loaded = load_chat_messages(root_string).expect("messages should load");

        assert_eq!(loaded.len(), 3);
        assert_eq!(loaded[0].id, "m1");
        assert_eq!(loaded[1].id, "m2");
        assert_eq!(loaded[2].id, "m3");
        assert_eq!(loaded[1].stream_status, Some("done".to_string()));
        assert_eq!(
            loaded[0].input_references_json,
            Some("[{\"id\":\"r1\",\"kind\":\"text\",\"content\":\"ref\",\"displayName\":\"Ref\",\"createdAt\":100}]".to_string()),
        );

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn test_save_chat_messages_replaces_same_session() {
        let root = test_workspace_root("chat-replace");
        fs::create_dir_all(&root).expect("fixture workspace should be created");
        initialize_workspace_metadata(&root).expect("metadata should initialize");
        let root_string = root.to_string_lossy().to_string();

        let batch1 = vec![
            ChatMessageRecord {
                id: "old1".to_string(), role: "user".to_string(),
                content: "batch one".to_string(), stream_status: None, tool_call_id: None,
                input_references_json: None,
                active_file_path: None,
                created_at: 1_000, session_id: root_string.clone(),
            },
        ];
        let batch2 = vec![
            ChatMessageRecord {
                id: "new1".to_string(), role: "user".to_string(),
                content: "batch two a".to_string(), stream_status: None, tool_call_id: None,
                input_references_json: None,
                active_file_path: None,
                created_at: 2_000, session_id: root_string.clone(),
            },
            ChatMessageRecord {
                id: "new2".to_string(), role: "assistant".to_string(),
                content: "batch two b".to_string(), stream_status: None, tool_call_id: None,
                input_references_json: None,
                active_file_path: None,
                created_at: 3_000, session_id: root_string.clone(),
            },
        ];
        save_chat_messages(root_string.clone(), batch1).expect("batch1 should be saved");
        save_chat_messages(root_string.clone(), batch2).expect("batch2 should be saved");
        let loaded = load_chat_messages(root_string).expect("messages should load");

        // Only the second batch should remain (DELETE + INSERT per spec)
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].id, "new1");
        assert_eq!(loaded[1].id, "new2");
        assert!(!loaded.iter().any(|m| m.id == "old1"));

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn test_clear_chat_messages_removes_current_session_history() {
        let root = test_workspace_root("chat-clear");
        fs::create_dir_all(&root).expect("fixture workspace should be created");
        initialize_workspace_metadata(&root).expect("metadata should initialize");
        let root_string = root.to_string_lossy().to_string();

        save_chat_messages(
            root_string.clone(),
            vec![ChatMessageRecord {
                id: "clear-1".to_string(),
                role: "user".to_string(),
                content: "remove me".to_string(),
                stream_status: None,
                tool_call_id: None,
                input_references_json: None,
                active_file_path: None,
                created_at: 1_000,
                session_id: root_string.clone(),
            }],
        )
        .expect("message should be saved before clear");
        clear_chat_messages(root_string.clone()).expect("messages should clear");
        let loaded = load_chat_messages(root_string).expect("messages should load after clear");

        assert!(loaded.is_empty());
        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn migrates_legacy_chat_messages_without_session_id() {
        let root = test_workspace_root("chat-legacy-session-id");
        fs::create_dir_all(root.join(".binder")).expect("fixture workspace should be created");
        let db_path = workspace_database_path(&root);
        {
            let conn = Connection::open(&db_path).expect("legacy db should open");
            conn.execute_batch(
                r#"
                CREATE TABLE chat_messages (
                    id TEXT PRIMARY KEY,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );
                INSERT INTO chat_messages (id, role, content, created_at)
                VALUES ('legacy-1', 'user', 'old message', 1000);
                "#,
            )
            .expect("legacy chat_messages table should be created");
        }

        initialize_workspace_metadata(&root).expect("metadata should migrate legacy schema");
        let root_string = root.to_string_lossy().to_string();
        save_chat_messages(
            root_string.clone(),
            vec![ChatMessageRecord {
                id: "new-1".to_string(),
                role: "user".to_string(),
                content: "new message".to_string(),
                stream_status: None,
                tool_call_id: None,
                input_references_json: None,
                active_file_path: None,
                created_at: 2_000,
                session_id: root_string.clone(),
            }],
        )
        .expect("save should work after session_id migration");
        let loaded = load_chat_messages(root_string).expect("messages should load after migration");

        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "new-1");
        assert_eq!(loaded[0].content, "new message");

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }

    #[test]
    fn structure_mutations_refresh_search_index() {
        let root = test_workspace_root("search-structure");
        fs::create_dir_all(&root).expect("fixture workspace should be created");
        let root_string = root.to_string_lossy().to_string();
        initialize_workspace_metadata(&root).expect("metadata should initialize");
        create_workspace_item(&root_string, "draft.md", "file").expect("file should be created");
        write_workspace_file(
            root_string.clone(),
            "draft.md".to_string(),
            "structure searchable".to_string(),
        )
        .expect("workspace file should be written");

        let renamed = rename_workspace_item_impl(&root_string, "draft.md", "final.md")
            .expect("file should be renamed");
        let results = search_files(root_string, "structure".to_string())
            .expect("search should run after rename");

        assert!(renamed.success);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file_path, "final.md");

        fs::remove_dir_all(root).expect("fixture workspace should be removed");
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|_app| {
            #[cfg(debug_assertions)]
            if let Some(webview) = _app.get_webview_window("main") {
                webview.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            health_check,
            open_workspace,
            list_recent_workspaces,
            read_workspace_file,
            write_workspace_file,
            read_file,
            list_files,
            create_workspace_file,
            create_workspace_folder,
            rename_workspace_item,
            move_workspace_item,
            delete_workspace_item,
            search_files,
            save_pending_diff,
            update_diff_status,
            save_terminal_card,
            save_terminal_cards,
            load_diffs_from_workspace,
            recover_diffs_from_workspace,
            hash_workspace_file,
            save_chat_messages,
            clear_chat_messages,
            load_chat_messages,
            save_api_key,
            is_api_key_configured,
            chat_stream
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Binder Mini");
}
