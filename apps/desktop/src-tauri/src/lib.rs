mod auth;
mod github;
mod storage;

use serde::{Deserialize, Serialize};
use storage::AppStorage;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendStatus {
    backend: &'static str,
    storage: &'static str,
    worker: &'static str,
    provider: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StarSyncSummary {
    account_login: String,
    synced_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReadmeFetchSummary {
    total_count: usize,
    fetched_count: usize,
    skipped_count: usize,
    missing_count: usize,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepositoryListRequest {
    limit: Option<usize>,
    offset: Option<usize>,
    keyword: Option<String>,
    language: Option<String>,
    tag_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListTagsRequest {
    account_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateTagRequest {
    account_id: String,
    name: String,
    color: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateTagRequest {
    account_id: String,
    tag_id: String,
    name: String,
    color: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteTagRequest {
    account_id: String,
    tag_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepositoryAnnotationRequest {
    account_id: String,
    repository_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveRepositoryAnnotationRequest {
    account_id: String,
    repository_id: String,
    note_markdown: String,
    reading_status: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetRepositoryTagsRequest {
    account_id: String,
    repository_id: String,
    tag_ids: Vec<String>,
}

#[tauri::command]
fn get_backend_status() -> BackendStatus {
    BackendStatus {
        backend: "Rust 本地后端已就绪",
        storage: "SQLite 已接入",
        worker: "GitHub Stars 同步可用",
        provider: "Provider 抽象待实现",
    }
}

#[tauri::command]
fn get_github_auth_state() -> Result<auth::GitHubAuthState, String> {
    auth::get_auth_state()
}

#[tauri::command]
fn save_github_token(token: String) -> Result<auth::GitHubUser, String> {
    auth::save_github_token(token)
}

#[tauri::command]
fn clear_github_token() -> Result<(), String> {
    auth::clear_github_token()
}

#[tauri::command]
fn sync_github_stars(app_handle: tauri::AppHandle) -> Result<StarSyncSummary, String> {
    let token = auth::require_github_token()?;
    let user = auth::verify_github_token(&token)?;
    let storage = AppStorage::from_app_handle(&app_handle)?;
    let account_id = user.id.to_string();
    let repositories = github::fetch_all_starred_repositories(&token, &account_id)?;

    storage.upsert_github_account(&user)?;
    storage.upsert_repositories(&repositories)?;

    Ok(StarSyncSummary {
        account_login: user.login,
        synced_count: repositories.len(),
    })
}

#[tauri::command]
fn fetch_repository_readmes(app_handle: tauri::AppHandle) -> Result<ReadmeFetchSummary, String> {
    let token = auth::require_github_token()?;
    let storage = AppStorage::from_app_handle(&app_handle)?;
    let repositories = storage.list_active_repositories()?;
    let total_count = repositories.len();
    let mut fetched_count = 0_usize;
    let mut skipped_count = 0_usize;
    let mut missing_count = 0_usize;

    for repository in repositories {
        let Some(readme) = github::fetch_readme(&token, &repository.id, &repository.full_name)?
        else {
            missing_count += 1;
            continue;
        };

        if storage.get_readme_hash(&repository.id)?.as_deref() == Some(readme.content_hash.as_str())
        {
            skipped_count += 1;
            continue;
        }

        storage.save_readme(&readme)?;
        fetched_count += 1;
    }

    Ok(ReadmeFetchSummary {
        total_count,
        fetched_count,
        skipped_count,
        missing_count,
    })
}

#[tauri::command]
fn list_repositories(
    app_handle: tauri::AppHandle,
    request: Option<RepositoryListRequest>,
) -> Result<storage::RepositoryListPage, String> {
    let request = request.unwrap_or(RepositoryListRequest {
        limit: Some(1000),
        offset: Some(0),
        keyword: None,
        language: None,
        tag_id: None,
    });
    let storage = AppStorage::from_app_handle(&app_handle)?;

    storage.list_repository_page(
        request.limit.unwrap_or(1000),
        request.offset.unwrap_or(0),
        storage::RepositoryListFilters {
            keyword: request.keyword.as_deref(),
            language: request.language.as_deref(),
            tag_id: request.tag_id.as_deref(),
        },
    )
}

#[tauri::command]
fn list_repository_languages(app_handle: tauri::AppHandle) -> Result<Vec<String>, String> {
    let storage = AppStorage::from_app_handle(&app_handle)?;

    storage.list_repository_languages()
}

#[tauri::command]
fn list_tags(
    app_handle: tauri::AppHandle,
    request: ListTagsRequest,
) -> Result<Vec<storage::TagItem>, String> {
    let storage = AppStorage::from_app_handle(&app_handle)?;

    storage.list_tags(&request.account_id)
}

#[tauri::command]
fn create_tag(
    app_handle: tauri::AppHandle,
    request: CreateTagRequest,
) -> Result<storage::TagItem, String> {
    let storage = AppStorage::from_app_handle(&app_handle)?;

    storage.create_tag(&request.account_id, &request.name, request.color.as_deref())
}

#[tauri::command]
fn update_tag(
    app_handle: tauri::AppHandle,
    request: UpdateTagRequest,
) -> Result<storage::TagItem, String> {
    let storage = AppStorage::from_app_handle(&app_handle)?;

    storage.update_tag(
        &request.account_id,
        &request.tag_id,
        &request.name,
        request.color.as_deref(),
    )
}

#[tauri::command]
fn delete_tag(app_handle: tauri::AppHandle, request: DeleteTagRequest) -> Result<(), String> {
    let storage = AppStorage::from_app_handle(&app_handle)?;

    storage.delete_tag(&request.account_id, &request.tag_id)
}

#[tauri::command]
fn get_repository_annotation(
    app_handle: tauri::AppHandle,
    request: RepositoryAnnotationRequest,
) -> Result<storage::RepositoryAnnotationView, String> {
    let storage = AppStorage::from_app_handle(&app_handle)?;

    storage.get_repository_annotation(&request.repository_id, &request.account_id)
}

#[tauri::command]
fn save_repository_annotation(
    app_handle: tauri::AppHandle,
    request: SaveRepositoryAnnotationRequest,
) -> Result<storage::RepositoryAnnotationView, String> {
    let storage = AppStorage::from_app_handle(&app_handle)?;

    storage.save_repository_annotation(
        &request.repository_id,
        &request.account_id,
        &request.note_markdown,
        &request.reading_status,
    )
}

#[tauri::command]
fn set_repository_tags(
    app_handle: tauri::AppHandle,
    request: SetRepositoryTagsRequest,
) -> Result<storage::RepositoryAnnotationView, String> {
    let storage = AppStorage::from_app_handle(&app_handle)?;

    storage.set_repository_tags(
        &request.repository_id,
        &request.account_id,
        &request.tag_ids,
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_backend_status,
            get_github_auth_state,
            save_github_token,
            clear_github_token,
            sync_github_stars,
            fetch_repository_readmes,
            list_repositories,
            list_repository_languages,
            list_tags,
            create_tag,
            update_tag,
            delete_tag,
            get_repository_annotation,
            save_repository_annotation,
            set_repository_tags,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 应用运行失败");
}
