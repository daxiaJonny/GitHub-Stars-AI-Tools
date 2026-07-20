use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::Duration;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

const UPSTREAM_COMMITS_API: &str =
    "https://api.github.com/repos/xingranya/GitHub-Stars-AI-Tools/commits";
const UPSTREAM_COMMITS_PER_PAGE: usize = 30;
const UPSTREAM_CONNECT_TIMEOUT_SECONDS: u64 = 12;
const UPSTREAM_REQUEST_TIMEOUT_SECONDS: u64 = 30;
const UPSTREAM_USER_AGENT: &str = "GitHub-Stars-AI-Tools";
const UPSTREAM_REPO_URL: &str = "https://github.com/xingranya/GitHub-Stars-AI-Tools";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamCommit {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: Option<String>,
    pub date: String,
    pub html_url: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamUpdateReport {
    pub latest_sha: Option<String>,
    pub last_seen_sha: Option<String>,
    pub new_count: usize,
    pub commits: Vec<UpstreamCommit>,
    pub last_checked_at: String,
    pub repo_url: String,
    pub error: Option<String>,
}

#[derive(Deserialize)]
struct GithubCommit {
    sha: String,
    commit: GithubCommitDetail,
    html_url: String,
    author: Option<GithubCommitAuthor>,
}

#[derive(Deserialize)]
struct GithubCommitDetail {
    message: String,
    author: Option<GithubCommitAuthor>,
}

#[derive(Deserialize)]
struct GithubCommitAuthor {
    login: Option<String>,
    date: Option<String>,
}

#[derive(Deserialize, Serialize)]
struct UpstreamCheckRecord {
    last_seen_sha: Option<String>,
    last_checked_at: Option<String>,
}

/// 调 GitHub 公开 API 抓取上游最近提交，对比本地 last_seen_sha 标记新增。
pub fn check_upstream_commits(app_data_dir: &Path) -> UpstreamUpdateReport {
    let last_checked_at = current_timestamp();
    let existing_record = read_upstream_check_record(app_data_dir).unwrap_or(None);
    let last_seen_sha = existing_record
        .as_ref()
        .and_then(|record| record.last_seen_sha.clone());

    match fetch_upstream_commits() {
        Ok(commits) => {
            let latest_sha = commits.first().map(|commit| commit.sha.clone());
            let new_count = match &last_seen_sha {
                Some(seen) => commits
                    .iter()
                    .take_while(|commit| &commit.sha != seen)
                    .count(),
                None => commits.len(),
            };
            let _ = write_upstream_check_record(
                app_data_dir,
                &UpstreamCheckRecord {
                    last_seen_sha: last_seen_sha.clone(),
                    last_checked_at: Some(last_checked_at.clone()),
                },
            );
            UpstreamUpdateReport {
                latest_sha,
                last_seen_sha,
                new_count,
                commits: commits.into_iter().map(into_upstream_commit).collect(),
                last_checked_at,
                repo_url: UPSTREAM_REPO_URL.to_owned(),
                error: None,
            }
        }
        Err(error) => UpstreamUpdateReport {
            latest_sha: None,
            last_seen_sha,
            new_count: 0,
            commits: Vec::new(),
            last_checked_at,
            repo_url: UPSTREAM_REPO_URL.to_owned(),
            error: Some(error),
        },
    }
}

/// 将 last_seen_sha 标记为指定提交，之后该提交之前的更新不再计为新增。
pub fn mark_upstream_seen(app_data_dir: &Path, sha: &str) -> Result<(), String> {
    let record = read_upstream_check_record(app_data_dir)?.unwrap_or(UpstreamCheckRecord {
        last_seen_sha: None,
        last_checked_at: None,
    });
    write_upstream_check_record(
        app_data_dir,
        &UpstreamCheckRecord {
            last_seen_sha: Some(sha.to_owned()),
            last_checked_at: record.last_checked_at,
        },
    )
}

fn fetch_upstream_commits() -> Result<Vec<GithubCommit>, String> {
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(UPSTREAM_CONNECT_TIMEOUT_SECONDS))
        .timeout(Duration::from_secs(UPSTREAM_REQUEST_TIMEOUT_SECONDS))
        .user_agent(UPSTREAM_USER_AGENT)
        .build()
        .map_err(|error| format!("上游更新检查请求初始化失败：{error}"))?;
    let url = format!("{UPSTREAM_COMMITS_API}?per_page={UPSTREAM_COMMITS_PER_PAGE}");
    let response = client
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .map_err(|error| format!("上游更新检查请求失败：{error}"))?;
    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("上游更新检查响应读取失败：{error}"))?;
    if !status.is_success() {
        let detail: String = body.chars().take(180).collect();
        return Err(format!(
            "上游更新检查失败（HTTP {}）：{detail}",
            status.as_u16()
        ));
    }
    serde_json::from_str::<Vec<GithubCommit>>(&body)
        .map_err(|error| format!("上游更新响应解析失败：{error}"))
}

fn into_upstream_commit(commit: GithubCommit) -> UpstreamCommit {
    let message = commit
        .commit
        .message
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .to_owned();
    let short_sha: String = commit.sha.chars().take(7).collect();
    let author = commit
        .author
        .as_ref()
        .and_then(|author| author.login.clone())
        .or_else(|| {
            commit
                .commit
                .author
                .as_ref()
                .and_then(|author| author.login.clone())
        });
    let date = commit
        .commit
        .author
        .as_ref()
        .and_then(|author| author.date.clone())
        .unwrap_or_default();
    UpstreamCommit {
        sha: commit.sha,
        short_sha,
        message,
        author,
        date,
        html_url: commit.html_url,
    }
}

fn upstream_check_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("upstream-check.json")
}

fn read_upstream_check_record(app_data_dir: &Path) -> Result<Option<UpstreamCheckRecord>, String> {
    let path = upstream_check_path(app_data_dir);
    if !path.exists() {
        return Ok(None);
    }
    let content =
        std::fs::read_to_string(&path).map_err(|error| format!("上游检查记录读取失败：{error}"))?;
    if content.trim().is_empty() {
        return Ok(None);
    }
    serde_json::from_str(&content).map_err(|error| format!("上游检查记录解析失败：{error}"))
}

fn write_upstream_check_record(
    app_data_dir: &Path,
    record: &UpstreamCheckRecord,
) -> Result<(), String> {
    std::fs::create_dir_all(app_data_dir).map_err(|error| format!("数据目录创建失败：{error}"))?;
    let path = upstream_check_path(app_data_dir);
    let content = serde_json::to_string_pretty(record)
        .map_err(|error| format!("上游检查记录序列化失败：{error}"))?;
    std::fs::write(&path, content).map_err(|error| format!("上游检查记录写入失败：{error}"))?;
    restrict_permissions(&path);
    Ok(())
}

fn current_timestamp() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_default()
}

#[cfg(target_family = "unix")]
fn restrict_permissions(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    if let Ok(metadata) = std::fs::metadata(path) {
        let mut permissions = metadata.permissions();
        permissions.set_mode(0o600);
        let _ = std::fs::set_permissions(path, permissions);
    }
}

#[cfg(not(target_family = "unix"))]
fn restrict_permissions(_path: &Path) {}
