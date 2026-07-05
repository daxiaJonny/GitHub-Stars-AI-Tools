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
    active_count: usize,
    created_count: usize,
    updated_count: usize,
    removed_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReadmeFetchSummary {
    total_count: usize,
    fetched_count: usize,
    skipped_count: usize,
    missing_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GistAnnotationExportSummary {
    gist_id: String,
    html_url: String,
    tag_count: usize,
    repository_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GistAnnotationImportSummary {
    tag_count: usize,
    repository_count: usize,
    skipped_repository_count: usize,
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
struct RepositoryDetailRequest {
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportAnnotationGistRequest {
    gist_id: String,
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
    let reconcile_summary = storage.reconcile_starred_repositories(&account_id, &repositories)?;

    Ok(StarSyncSummary {
        account_login: user.login,
        active_count: reconcile_summary.active_count,
        created_count: reconcile_summary.created_count,
        updated_count: reconcile_summary.updated_count,
        removed_count: reconcile_summary.removed_count,
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
fn get_repository_detail(
    app_handle: tauri::AppHandle,
    request: RepositoryDetailRequest,
) -> Result<storage::RepositoryDetailView, String> {
    let storage = AppStorage::from_app_handle(&app_handle)?;

    storage.get_repository_detail(&request.repository_id, &request.account_id)
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveAiDocumentRequest {
    repository_id: String,
    summary_zh: String,
    readme_zh: Option<String>,
    keywords: Vec<String>,
    suggested_tags: Vec<String>,
    model: String,
    prompt_version: String,
    source_hash: String,
}

#[tauri::command]
fn get_dashboard_stats(
    app_handle: tauri::AppHandle,
) -> Result<storage::DashboardStatsData, String> {
    let storage = AppStorage::from_app_handle(&app_handle)?;
    storage.get_dashboard_stats()
}

#[tauri::command]
fn get_tag_network_data(app_handle: tauri::AppHandle) -> Result<storage::TagNetworkData, String> {
    let storage = AppStorage::from_app_handle(&app_handle)?;
    storage.get_tag_network_data()
}

#[tauri::command]
fn get_profile_stats(
    app_handle: tauri::AppHandle,
    request: Option<ListTagsRequest>,
) -> Result<storage::ProfileStatsData, String> {
    let storage = AppStorage::from_app_handle(&app_handle)?;
    // 使用传入的 account_id 或尝试从 auth state 获取
    let account_id = match request {
        Some(req) => req.account_id,
        None => {
            let token = auth::require_github_token()?;
            let user = auth::verify_github_token(&token)?;
            user.id.to_string()
        }
    };
    storage.get_profile_stats(&account_id)
}

#[tauri::command]
fn save_repository_ai_document(
    app_handle: tauri::AppHandle,
    request: SaveAiDocumentRequest,
) -> Result<(), String> {
    let storage = AppStorage::from_app_handle(&app_handle)?;
    storage.save_repository_ai_document(
        &request.repository_id,
        &request.summary_zh,
        request.readme_zh.as_deref(),
        &request.keywords,
        &request.suggested_tags,
        &request.model,
        &request.prompt_version,
        &request.source_hash,
    )
}

#[tauri::command]
fn export_annotation_gist(
    app_handle: tauri::AppHandle,
) -> Result<GistAnnotationExportSummary, String> {
    let token = auth::require_github_token()?;
    let user = auth::verify_github_token(&token)?;
    let account_id = user.id.to_string();
    let storage = AppStorage::from_app_handle(&app_handle)?;
    let snapshot = storage.export_annotation_snapshot(&account_id)?;
    let tag_count = snapshot.tags.len();
    let repository_count = snapshot.repositories.len();
    let snapshot_json = serde_json::to_string_pretty(&snapshot)
        .map_err(|error| format!("注解快照序列化失败：{error}"))?;
    let gist = github::create_annotation_gist(&token, &snapshot_json)?;

    Ok(GistAnnotationExportSummary {
        gist_id: gist.gist_id,
        html_url: gist.html_url,
        tag_count,
        repository_count,
    })
}

#[tauri::command]
fn import_annotation_gist(
    app_handle: tauri::AppHandle,
    request: ImportAnnotationGistRequest,
) -> Result<GistAnnotationImportSummary, String> {
    let token = auth::require_github_token()?;
    let user = auth::verify_github_token(&token)?;
    let account_id = user.id.to_string();
    let snapshot_json = github::fetch_annotation_gist(&token, &request.gist_id)?;
    let snapshot = serde_json::from_str::<storage::AnnotationSnapshot>(&snapshot_json)
        .map_err(|error| format!("注解快照解析失败：{error}"))?;
    let storage = AppStorage::from_app_handle(&app_handle)?;
    let summary = storage.import_annotation_snapshot(&account_id, &snapshot)?;

    Ok(GistAnnotationImportSummary {
        tag_count: summary.tag_count,
        repository_count: summary.repository_count,
        skipped_repository_count: summary.skipped_repository_count,
    })
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
            get_repository_detail,
            list_tags,
            create_tag,
            update_tag,
            delete_tag,
            get_repository_annotation,
            save_repository_annotation,
            set_repository_tags,
            export_annotation_gist,
            import_annotation_gist,
            get_dashboard_stats,
            get_tag_network_data,
            get_profile_stats,
            save_repository_ai_document,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 应用运行失败");
}
