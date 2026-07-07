use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

const GITHUB_TOKEN_SERVICE: &str = "github-stars-ai-tools";
const GITHUB_TOKEN_ACCOUNT: &str = "github-pat";
const GITHUB_USER_API: &str = "https://api.github.com/user";
const GITHUB_API_VERSION: &str = "2022-11-28";
const GITHUB_CONNECT_TIMEOUT_SECONDS: u16 = 12;
const GITHUB_CONNECT_VERIFY_TIMEOUT_SECONDS: u64 = 15;
const GITHUB_CONNECT_VERIFY_MAX_ATTEMPTS: usize = 1;
const GITHUB_REQUEST_TIMEOUT_SECONDS: u16 = 45;
const GITHUB_API_MAX_ATTEMPTS: usize = 3;
const GITHUB_API_RETRY_BASE_DELAY_MS: u64 = 450;
static SECURE_PASSWORD_CACHE: OnceLock<Mutex<HashMap<String, Option<String>>>> = OnceLock::new();
static SECURE_STORE_INIT: OnceLock<Result<(), String>> = OnceLock::new();

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubUser {
    pub id: u64,
    pub login: String,
    pub name: Option<String>,
    #[serde(alias = "avatar_url")]
    pub avatar_url: Option<String>,
    #[serde(alias = "html_url")]
    pub html_url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubAuthState {
    pub has_token: bool,
    pub user: Option<GitHubUser>,
}

pub struct GitHubAuthStateCheck {
    pub state: GitHubAuthState,
    pub verification_error: Option<String>,
}

pub fn get_auth_state_check() -> Result<GitHubAuthStateCheck, String> {
    let token = match read_github_token()? {
        Some(token) => token,
        None => {
            return Ok(GitHubAuthStateCheck {
                state: GitHubAuthState {
                    has_token: false,
                    user: None,
                },
                verification_error: None,
            });
        }
    };

    match verify_github_token(&token) {
        Ok(user) => Ok(GitHubAuthStateCheck {
            state: GitHubAuthState {
                has_token: true,
                user: Some(user),
            },
            verification_error: None,
        }),
        Err(error) => Ok(GitHubAuthStateCheck {
            state: GitHubAuthState {
                has_token: true,
                user: None,
            },
            verification_error: Some(error),
        }),
    }
}

pub fn can_restore_cached_user_after_auth_error(error: &str) -> bool {
    !(error.contains("Token 无效或权限不足") || error.contains("HTTP 401"))
}

pub fn save_github_token(token: String) -> Result<GitHubUser, String> {
    let token = token.trim().to_owned();

    if token.is_empty() {
        return Err("请输入 GitHub Personal Access Token".to_owned());
    }

    let user = verify_github_token_for_connect(&token)?;
    save_github_token_to_secure_store(&token)?;

    Ok(user)
}

pub fn clear_github_token() -> Result<(), String> {
    delete_github_token_from_secure_store()
}

pub fn read_secure_password(service: &str, account: &str) -> Result<Option<String>, String> {
    read_password_from_secure_store(service, account)
}

pub fn save_secure_password(service: &str, account: &str, password: &str) -> Result<(), String> {
    let password = password.trim();
    if password.is_empty() {
        return delete_secure_password(service, account);
    }

    save_password_to_secure_store(service, account, password)
}

pub fn delete_secure_password(service: &str, account: &str) -> Result<(), String> {
    delete_password_from_secure_store(service, account)
}

pub fn require_github_token() -> Result<String, String> {
    read_github_token()?.ok_or_else(|| "请先连接 GitHub 账号".to_owned())
}

pub fn verify_github_token(token: &str) -> Result<GitHubUser, String> {
    let body = github_api_get(token, GITHUB_USER_API, "application/vnd.github+json")?;
    serde_json::from_str::<GitHubUser>(&body)
        .map_err(|error| format!("GitHub 用户信息解析失败：{error}"))
}

fn verify_github_token_for_connect(token: &str) -> Result<GitHubUser, String> {
    let body = github_api_get_with_options(
        token,
        GITHUB_USER_API,
        "application/vnd.github+json",
        GitHubRequestOptions {
            request_timeout_seconds: GITHUB_CONNECT_VERIFY_TIMEOUT_SECONDS,
            max_attempts: GITHUB_CONNECT_VERIFY_MAX_ATTEMPTS,
            retry_base_delay_ms: GITHUB_API_RETRY_BASE_DELAY_MS,
        },
    )?;
    serde_json::from_str::<GitHubUser>(&body)
        .map_err(|error| format!("GitHub 用户信息解析失败：{error}"))
}

pub fn github_api_get(token: &str, url: &str, accept: &str) -> Result<String, String> {
    let response = github_api_request(token, url, accept)?;

    if !response.status_success {
        return Err(format_github_http_error_with_rate_limit(&response));
    }

    Ok(response.body)
}

fn github_api_get_with_options(
    token: &str,
    url: &str,
    accept: &str,
    options: GitHubRequestOptions,
) -> Result<String, String> {
    let response = github_api_request_with_options(token, url, accept, options)?;

    if !response.status_success {
        return Err(format_github_http_error_with_rate_limit(&response));
    }

    Ok(response.body)
}

pub fn github_api_get_optional(
    token: &str,
    url: &str,
    accept: &str,
) -> Result<Option<String>, String> {
    let response = github_api_request(token, url, accept)?;

    if response.status_success {
        return Ok(Some(response.body));
    }

    if response.http_code == Some(404) {
        return Ok(None);
    }

    Err(format_github_http_error_with_rate_limit(&response))
}

pub fn github_api_post(token: &str, url: &str, accept: &str, body: &str) -> Result<String, String> {
    let response = github_api_request_with_body(token, url, accept, "POST", body)?;

    if !response.status_success {
        return Err(format_github_http_error_with_rate_limit(&response));
    }

    Ok(response.body)
}

pub fn github_api_put_empty(token: &str, url: &str, accept: &str) -> Result<(), String> {
    let response = github_api_request_with_optional_body(token, url, accept, "PUT", None)?;

    if !response.status_success {
        return Err(format_github_http_error_with_rate_limit(&response));
    }

    Ok(())
}

struct GitHubApiResponse {
    status_success: bool,
    http_code: Option<u16>,
    body: String,
    rate_limit_remaining: Option<u32>,
    rate_limit_reset: Option<u64>,
    retry_after_seconds: Option<u64>,
}

#[derive(Clone, Copy)]
struct GitHubRequestOptions {
    request_timeout_seconds: u64,
    max_attempts: usize,
    retry_base_delay_ms: u64,
}

fn default_github_request_options() -> GitHubRequestOptions {
    GitHubRequestOptions {
        request_timeout_seconds: GITHUB_REQUEST_TIMEOUT_SECONDS.into(),
        max_attempts: GITHUB_API_MAX_ATTEMPTS,
        retry_base_delay_ms: GITHUB_API_RETRY_BASE_DELAY_MS,
    }
}

fn github_api_request(token: &str, url: &str, accept: &str) -> Result<GitHubApiResponse, String> {
    github_api_request_with_options(token, url, accept, default_github_request_options())
}

fn github_api_request_with_options(
    token: &str,
    url: &str,
    accept: &str,
    options: GitHubRequestOptions,
) -> Result<GitHubApiResponse, String> {
    github_api_request_with_optional_body_options(token, url, accept, "GET", None, options)
}

fn github_api_request_with_body(
    token: &str,
    url: &str,
    accept: &str,
    method: &str,
    body: &str,
) -> Result<GitHubApiResponse, String> {
    github_api_request_with_optional_body(token, url, accept, method, Some(body))
}

fn github_api_request_with_optional_body(
    token: &str,
    url: &str,
    accept: &str,
    method: &str,
    body: Option<&str>,
) -> Result<GitHubApiResponse, String> {
    github_api_request_with_optional_body_options(
        token,
        url,
        accept,
        method,
        body,
        default_github_request_options(),
    )
}

fn github_api_request_with_optional_body_options(
    token: &str,
    url: &str,
    accept: &str,
    method: &str,
    body: Option<&str>,
    options: GitHubRequestOptions,
) -> Result<GitHubApiResponse, String> {
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(GITHUB_CONNECT_TIMEOUT_SECONDS.into()))
        .timeout(Duration::from_secs(options.request_timeout_seconds))
        .user_agent("GitHub-Stars-AI-Tools")
        .build()
        .map_err(|error| format!("GitHub API 请求初始化失败：{error}"))?;
    let method = method
        .parse::<reqwest::Method>()
        .map_err(|error| format!("GitHub API 请求方法无效：{error}"))?;

    for attempt in 1..=options.max_attempts.max(1) {
        let mut request = client
            .request(method.clone(), url)
            .header("Accept", accept)
            .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
            .bearer_auth(token);

        if let Some(body) = body {
            request = request
                .header("Content-Type", "application/json")
                .body(body.to_owned());
        }

        let response = match request.send() {
            Ok(response) => response,
            Err(error)
                if should_retry_github_transport_error(&error, attempt, options.max_attempts) =>
            {
                sleep_before_github_retry(attempt, None, options.retry_base_delay_ms);
                continue;
            }
            Err(error) => {
                return Err(format_github_request_error(
                    error,
                    options.request_timeout_seconds,
                ))
            }
        };
        let status = response.status();
        let headers = response.headers().clone();
        let body = response
            .text()
            .map_err(|error| format!("GitHub API 响应读取失败：{error}"))?;
        let api_response = GitHubApiResponse {
            status_success: status.is_success(),
            http_code: Some(status.as_u16()),
            body,
            rate_limit_remaining: parse_u32_header(&headers, "x-ratelimit-remaining"),
            rate_limit_reset: parse_u64_header(&headers, "x-ratelimit-reset"),
            retry_after_seconds: parse_u64_header(&headers, "retry-after"),
        };

        if should_retry_github_response(&api_response, attempt, options.max_attempts) {
            sleep_before_github_retry(
                attempt,
                api_response.retry_after_seconds,
                options.retry_base_delay_ms,
            );
            continue;
        }

        return Ok(api_response);
    }

    Err("GitHub API 请求多次重试后仍未成功，请稍后再试。".to_owned())
}

fn format_github_request_error(error: reqwest::Error, timeout_seconds: u64) -> String {
    if error.is_timeout() {
        return format!(
            "GitHub API 请求超时，请检查网络连接或稍后重试（已等待 {timeout_seconds} 秒）。"
        );
    }

    format!("GitHub API 请求失败：{error}")
}

fn should_retry_github_transport_error(
    error: &reqwest::Error,
    attempt: usize,
    max_attempts: usize,
) -> bool {
    attempt < max_attempts && (error.is_timeout() || error.is_connect() || error.is_request())
}

fn should_retry_github_response(
    response: &GitHubApiResponse,
    attempt: usize,
    max_attempts: usize,
) -> bool {
    if attempt >= max_attempts {
        return false;
    }

    matches!(response.http_code, Some(429) | Some(500..=599))
        || response.retry_after_seconds.is_some()
}

fn sleep_before_github_retry(
    attempt: usize,
    retry_after_seconds: Option<u64>,
    retry_base_delay_ms: u64,
) {
    let delay = retry_after_seconds
        .map(|seconds| Duration::from_secs(seconds.min(5)))
        .unwrap_or_else(|| Duration::from_millis(retry_base_delay_ms * attempt as u64));
    std::thread::sleep(delay);
}

fn parse_u32_header(headers: &reqwest::header::HeaderMap, name: &str) -> Option<u32> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u32>().ok())
}

fn parse_u64_header(headers: &reqwest::header::HeaderMap, name: &str) -> Option<u64> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
}

fn format_github_http_error(http_code: Option<u16>, body: &str) -> String {
    let detail = extract_github_error_detail(body);

    let is_rate_limit = detail.as_deref().is_some_and(is_github_rate_limit_message);
    let is_scope_error = detail.as_deref().is_some_and(is_github_token_scope_message);

    let base_message = match http_code {
        Some(401) => "Token 无效或权限不足，请重新检查 GitHub Personal Access Token",
        Some(403) if is_rate_limit => "GitHub API 请求过于频繁，请稍后再试",
        Some(403) if is_scope_error => {
            "Token 权限不足，请检查 GitHub Personal Access Token 权限：同步私有 Stars 需要仓库读取权限，Gist 备份需要 gist 权限"
        }
        Some(403) => {
            "Token 无效或权限不足，请重新检查 GitHub Personal Access Token 权限：同步私有 Stars 需要仓库读取权限，Gist 备份需要 gist 权限"
        }
        Some(429) => "GitHub API 请求过于频繁，请稍后再试",
        Some(404) => "GitHub 资源不存在或当前 Token 无权访问",
        Some(code) if (500..600).contains(&code) => "GitHub 服务暂时不可用，请稍后重试",
        _ => "GitHub API 请求失败，请检查网络、Token 权限或 GitHub 限流状态",
    };

    match (http_code, detail) {
        (Some(code), Some(detail)) => format!("{base_message}（HTTP {code}：{detail}）"),
        (Some(code), None) => format!("{base_message}（HTTP {code}）"),
        (None, Some(detail)) => format!("{base_message}：{detail}"),
        (None, None) => base_message.to_owned(),
    }
}

fn format_github_http_error_with_rate_limit(response: &GitHubApiResponse) -> String {
    let mut message = format_github_http_error(response.http_code, &response.body);
    if is_rate_limited_response(response) {
        if let Some(reset_at) = response.rate_limit_reset {
            message.push_str(&format!("。GitHub 限流将在 Unix 时间 {reset_at} 后恢复"));
        } else if let Some(retry_after_seconds) = response.retry_after_seconds {
            message.push_str(&format!("。GitHub 建议 {retry_after_seconds} 秒后重试"));
        }
    }
    message
}

fn is_rate_limited_response(response: &GitHubApiResponse) -> bool {
    matches!(response.http_code, Some(403) | Some(429))
        && (response.rate_limit_remaining == Some(0)
            || response.retry_after_seconds.is_some()
            || extract_github_error_detail(&response.body)
                .as_deref()
                .is_some_and(is_github_rate_limit_message))
}

fn extract_github_error_detail(body: &str) -> Option<String> {
    let trimmed_body = body.trim();
    if trimmed_body.is_empty() {
        return None;
    }

    serde_json::from_str::<serde_json::Value>(trimmed_body)
        .ok()
        .and_then(|value| {
            value
                .pointer("/message")
                .and_then(extract_json_error_message)
                .or_else(|| {
                    value
                        .pointer("/errors")
                        .and_then(extract_json_error_message)
                })
                .or_else(|| {
                    value
                        .pointer("/documentation_url")
                        .and_then(extract_json_error_message)
                })
                .or_else(|| extract_json_error_message(&value))
        })
        .or_else(|| Some(trimmed_body.chars().take(180).collect::<String>()))
}

fn extract_json_error_message(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(message) => normalize_error_text(message),
        serde_json::Value::Array(items) => items.iter().find_map(extract_json_error_message),
        serde_json::Value::Object(object) => {
            for key in ["message", "detail", "resource", "code", "field"] {
                if let Some(message) = object.get(key).and_then(extract_json_error_message) {
                    return Some(message);
                }
            }
            object.values().find_map(extract_json_error_message)
        }
        _ => None,
    }
}

fn normalize_error_text(value: &str) -> Option<String> {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    (!normalized.is_empty()).then_some(normalized)
}

fn is_github_rate_limit_message(message: &str) -> bool {
    let normalized = message.to_ascii_lowercase();
    normalized.contains("rate limit")
        || normalized.contains("secondary rate")
        || normalized.contains("abuse detection")
}

fn is_github_token_scope_message(message: &str) -> bool {
    let normalized = message.to_ascii_lowercase();
    normalized.contains("resource not accessible")
        || normalized.contains("requires authentication")
        || normalized.contains("must have")
        || normalized.contains("insufficient")
        || normalized.contains("scope")
        || normalized.contains("permission")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    #[test]
    fn github_api_get_sends_bearer_accept_and_api_version() {
        let (url, request_handle) = spawn_http_server("200 OK", r#"{"ok":true}"#);
        let body = github_api_get("test-token", &url, "application/test+json")
            .expect("GitHub GET 请求应读取成功响应体");
        let request = request_handle.join().expect("本地 HTTP 服务应返回请求内容");
        let lower_request = request.to_ascii_lowercase();

        assert_eq!(body, r#"{"ok":true}"#);
        assert!(request.starts_with("GET /test HTTP/1.1"));
        assert!(lower_request.contains("authorization: bearer test-token"));
        assert!(lower_request.contains("accept: application/test+json"));
        assert!(lower_request.contains("x-github-api-version: 2022-11-28"));
        assert!(lower_request.contains("user-agent: github-stars-ai-tools"));
    }

    #[test]
    fn github_api_post_sends_json_body() {
        let (url, request_handle) = spawn_http_server("200 OK", r#"{"id":"gist-1"}"#);
        let body = github_api_post(
            "test-token",
            &url,
            "application/vnd.github+json",
            r#"{"description":"GSAT"}"#,
        )
        .expect("GitHub POST 请求应读取成功响应体");
        let request = request_handle.join().expect("本地 HTTP 服务应返回请求内容");
        let lower_request = request.to_ascii_lowercase();

        assert_eq!(body, r#"{"id":"gist-1"}"#);
        assert!(request.starts_with("POST /test HTTP/1.1"));
        assert!(lower_request.contains("content-type: application/json"));
        assert!(request.contains(r#"{"description":"GSAT"}"#));
    }

    #[test]
    fn github_api_put_empty_sends_put_without_json_body() {
        let (url, request_handle) = spawn_http_server("204 No Content", "");
        github_api_put_empty("test-token", &url, "application/vnd.github+json")
            .expect("GitHub PUT 空请求应接受成功响应");
        let request = request_handle.join().expect("本地 HTTP 服务应返回请求内容");
        let lower_request = request.to_ascii_lowercase();

        assert!(request.starts_with("PUT /test HTTP/1.1"));
        assert!(lower_request.contains("authorization: bearer test-token"));
        assert!(lower_request.contains("accept: application/vnd.github+json"));
        assert!(!lower_request.contains("content-type: application/json"));
    }

    #[test]
    fn github_api_post_formats_non_success_response() {
        let (url, request_handle) =
            spawn_http_server("403 Forbidden", r#"{"message":"Bad credentials"}"#);
        let error = github_api_post("bad-token", &url, "application/vnd.github+json", "{}")
            .expect_err("GitHub 非成功状态必须转成用户可读错误");
        let _ = request_handle.join().expect("本地 HTTP 服务应完成请求");

        assert!(error.contains("Token 无效或权限不足"));
        assert!(error.contains("HTTP 403"));
        assert!(error.contains("Bad credentials"));
    }

    #[test]
    fn github_api_get_retries_short_rate_limit_response() {
        let (url, request_handle) = spawn_sequence_http_server(vec![
            (
                "429 Too Many Requests",
                r#"{"message":"secondary rate limit"}"#,
                vec![("Retry-After", "0")],
            ),
            ("200 OK", r#"{"ok":true}"#, Vec::new()),
        ]);
        let body = github_api_get("test-token", &url, "application/vnd.github+json")
            .expect("短限流后应重试并读取成功响应");
        let requests = request_handle
            .join()
            .expect("本地 HTTP 服务应返回所有请求内容");

        assert_eq!(body, r#"{"ok":true}"#);
        assert_eq!(requests.len(), 2);
    }

    #[test]
    fn format_github_http_error_reports_invalid_token() {
        let message = format_github_http_error(
            Some(401),
            r#"{"message":"Bad credentials","documentation_url":"https://docs.github.com"}"#,
        );

        assert!(message.contains("Token 无效或权限不足"));
        assert!(message.contains("HTTP 401"));
        assert!(message.contains("Bad credentials"));
    }

    #[test]
    fn format_github_http_error_reports_server_failure() {
        let message = format_github_http_error(Some(502), "");

        assert!(message.contains("GitHub 服务暂时不可用"));
        assert!(message.contains("HTTP 502"));
    }

    #[test]
    fn format_github_http_error_reports_rate_limit_separately_from_invalid_token() {
        let message = format_github_http_error(
            Some(403),
            r#"{"message":"API rate limit exceeded for user ID 1001."}"#,
        );

        assert!(message.contains("GitHub API 请求过于频繁"));
        assert!(message.contains("HTTP 403"));
        assert!(!message.contains("Token 无效或权限不足"));
    }

    #[test]
    fn format_github_http_error_reports_rate_limit_reset_hint() {
        let message = format_github_http_error_with_rate_limit(&GitHubApiResponse {
            status_success: false,
            http_code: Some(403),
            body: r#"{"message":"API rate limit exceeded for user ID 1001."}"#.to_owned(),
            rate_limit_remaining: Some(0),
            rate_limit_reset: Some(1_783_512_000),
            retry_after_seconds: None,
        });

        assert!(message.contains("GitHub API 请求过于频繁"));
        assert!(message.contains("Unix 时间 1783512000 后恢复"));
    }

    #[test]
    fn format_github_http_error_reports_gist_scope_hint() {
        let message = format_github_http_error(
            Some(403),
            r#"{"message":"Resource not accessible by personal access token","documentation_url":"https://docs.github.com/rest/gists/gists#create-a-gist"}"#,
        );

        assert!(message.contains("Token 权限不足"));
        assert!(message.contains("Gist 备份需要 gist 权限"));
        assert!(message.contains("Resource not accessible"));
    }

    #[test]
    fn format_github_http_error_reads_errors_array() {
        let message = format_github_http_error(
            Some(422),
            r#"{"message":"Validation Failed","errors":[{"resource":"Search","field":"q","code":"invalid"}]}"#,
        );

        assert!(message.contains("Validation Failed"));
        assert!(message.contains("HTTP 422"));
    }

    #[test]
    fn format_github_http_error_reports_private_repo_scope_hint() {
        let message = format_github_http_error(Some(403), r#"{"message":"Forbidden"}"#);

        assert!(message.contains("Token 无效或权限不足"));
        assert!(message.contains("同步私有 Stars 需要仓库读取权限"));
        assert!(message.contains("Gist 备份需要 gist 权限"));
    }

    #[test]
    fn invalid_token_error_cannot_restore_cached_user() {
        assert!(!can_restore_cached_user_after_auth_error(
            "Token 无效或权限不足，请重新检查 GitHub Personal Access Token（HTTP 401：Bad credentials）"
        ));
        assert!(!can_restore_cached_user_after_auth_error(
            "Token 无效或权限不足，请重新检查 GitHub Personal Access Token（HTTP 403）"
        ));
    }

    #[test]
    fn network_error_can_restore_cached_user() {
        assert!(can_restore_cached_user_after_auth_error(
            "GitHub API 请求超时，请检查网络连接或稍后重试（已等待 45 秒）。"
        ));
        assert!(can_restore_cached_user_after_auth_error(
            "GitHub 服务暂时不可用，请稍后重试（HTTP 502）"
        ));
        assert!(can_restore_cached_user_after_auth_error(
            "GitHub API 请求过于频繁，请稍后再试（HTTP 403：API rate limit exceeded for user ID 1001.）"
        ));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_secure_store_initializes_keychain_before_entry_creation() {
        let service = "github-stars-ai-tools-test";
        let account = format!("default-store-check-{}", std::process::id());

        initialize_native_secure_store().expect("macOS 必须能注册系统 Keychain 凭据后端");
        keyring::Entry::new(service, &account)
            .expect("注册 Keychain 后应能创建系统凭据条目");
        let missing_password = read_secure_password(service, &account)
            .expect("系统 Keychain 读取路径不应再报默认后端缺失");
        assert!(missing_password.is_none());
    }

    fn spawn_http_server(
        status: &'static str,
        response_body: &'static str,
    ) -> (String, thread::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("应能启动本地测试 HTTP 服务");
        let address = listener.local_addr().expect("应能读取本地监听地址");
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("应能接收本地 HTTP 请求");
            stream
                .set_read_timeout(Some(std::time::Duration::from_secs(2)))
                .expect("应能设置读取超时");
            let request = read_http_request(&mut stream);
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response_body}",
                response_body.len()
            );
            stream
                .write_all(response.as_bytes())
                .expect("应能写入本地 HTTP 响应");
            request
        });

        (format!("http://{address}/test"), handle)
    }

    fn spawn_sequence_http_server(
        responses: Vec<(
            &'static str,
            &'static str,
            Vec<(&'static str, &'static str)>,
        )>,
    ) -> (String, thread::JoinHandle<Vec<String>>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("应能启动本地测试 HTTP 服务");
        let address = listener.local_addr().expect("应能读取本地监听地址");
        let handle = thread::spawn(move || {
            let mut requests = Vec::new();
            for (status, response_body, headers) in responses {
                let (mut stream, _) = listener.accept().expect("应能接收本地 HTTP 请求");
                stream
                    .set_read_timeout(Some(std::time::Duration::from_secs(2)))
                    .expect("应能设置读取超时");
                requests.push(read_http_request(&mut stream));
                let extra_headers = headers
                    .into_iter()
                    .map(|(name, value)| format!("{name}: {value}\r\n"))
                    .collect::<String>();
                let response = format!(
                    "HTTP/1.1 {status}\r\nContent-Type: application/json\r\n{extra_headers}Content-Length: {}\r\nConnection: close\r\n\r\n{response_body}",
                    response_body.len()
                );
                stream
                    .write_all(response.as_bytes())
                    .expect("应能写入本地 HTTP 响应");
            }
            requests
        });

        (format!("http://{address}/test"), handle)
    }

    fn read_http_request(stream: &mut std::net::TcpStream) -> String {
        let mut buffer = Vec::new();
        let mut chunk = [0; 1024];
        let mut expected_length = None;

        loop {
            let bytes_read = stream.read(&mut chunk).unwrap_or(0);
            if bytes_read == 0 {
                break;
            }
            buffer.extend_from_slice(&chunk[..bytes_read]);
            if expected_length.is_none() {
                expected_length = request_length_from_headers(&buffer);
            }
            if expected_length.is_some_and(|length| buffer.len() >= length) {
                break;
            }
        }

        String::from_utf8_lossy(&buffer).to_string()
    }

    fn request_length_from_headers(buffer: &[u8]) -> Option<usize> {
        let header_end = buffer.windows(4).position(|window| window == b"\r\n\r\n")?;
        let headers = String::from_utf8_lossy(&buffer[..header_end]);
        let content_length = headers
            .lines()
            .find_map(|line| {
                line.to_ascii_lowercase()
                    .strip_prefix("content-length:")
                    .and_then(|value| value.trim().parse::<usize>().ok())
            })
            .unwrap_or(0);

        Some(header_end + 4 + content_length)
    }
}

fn read_github_token() -> Result<Option<String>, String> {
    read_password_from_secure_store(GITHUB_TOKEN_SERVICE, GITHUB_TOKEN_ACCOUNT)
}

fn save_github_token_to_secure_store(token: &str) -> Result<(), String> {
    save_password_to_secure_store(GITHUB_TOKEN_SERVICE, GITHUB_TOKEN_ACCOUNT, token)
}

fn delete_github_token_from_secure_store() -> Result<(), String> {
    delete_password_from_secure_store(GITHUB_TOKEN_SERVICE, GITHUB_TOKEN_ACCOUNT)
}

fn read_password_from_secure_store(service: &str, account: &str) -> Result<Option<String>, String> {
    let cache_key = secure_password_cache_key(service, account);
    let cache = SECURE_PASSWORD_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    if let Some(cached) = cache
        .lock()
        .map_err(|_| "安全凭据缓存已损坏".to_owned())?
        .get(&cache_key)
        .cloned()
    {
        return Ok(cached);
    }

    let entry = secure_password_entry(service, account)?;
    let password = match entry.get_password() {
        Ok(password) => Some(password),
        Err(keyring::Error::NoEntry) => None,
        Err(error) => {
            return Err(format_secure_store_error("读取", error));
        }
    };
    cache
        .lock()
        .map_err(|_| "安全凭据缓存已损坏".to_owned())?
        .insert(cache_key, password.clone());
    Ok(password)
}

fn save_password_to_secure_store(
    service: &str,
    account: &str,
    password: &str,
) -> Result<(), String> {
    let entry = secure_password_entry(service, account)?;
    entry
        .set_password(password)
        .map_err(|error| format_secure_store_error("写入", error))?;
    update_secure_password_cache(service, account, Some(password.to_owned()))
}

fn delete_password_from_secure_store(service: &str, account: &str) -> Result<(), String> {
    let entry = secure_password_entry(service, account)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {}
        Err(error) => {
            return Err(format_secure_store_error("清除", error));
        }
    }
    update_secure_password_cache(service, account, None)
}

fn secure_password_cache_key(service: &str, account: &str) -> String {
    format!("{service}\n{account}")
}

fn update_secure_password_cache(
    service: &str,
    account: &str,
    password: Option<String>,
) -> Result<(), String> {
    SECURE_PASSWORD_CACHE
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|_| "安全凭据缓存已损坏".to_owned())?
        .insert(secure_password_cache_key(service, account), password);
    Ok(())
}

fn secure_password_entry(service: &str, account: &str) -> Result<keyring::Entry, String> {
    ensure_secure_store_initialized()?;
    keyring::Entry::new(service, account)
        .map_err(|error| format_secure_store_error("初始化", error))
}

fn ensure_secure_store_initialized() -> Result<(), String> {
    SECURE_STORE_INIT
        .get_or_init(|| initialize_native_secure_store().map_err(|error| format_secure_store_error("初始化", error)))
        .clone()
}

fn initialize_native_secure_store() -> keyring::Result<()> {
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    {
        let store = apple_native_keyring_store::keychain::Store::new()?;
        keyring_core::set_default_store(store);
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        let store = windows_native_keyring_store::Store::new()?;
        keyring_core::set_default_store(store);
        return Ok(());
    }

    #[cfg(all(
        unix,
        not(any(target_os = "macos", target_os = "ios", target_os = "android"))
    ))]
    {
        let store = zbus_secret_service_keyring_store::Store::new()?;
        keyring_core::set_default_store(store);
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err(keyring::Error::NoDefaultStore)
}

fn format_secure_store_error(action: &str, error: keyring::Error) -> String {
    format!(
        "安全凭据{action}失败：{error}。请确认系统凭据管理器可用，macOS 需要 Keychain，Windows 需要 Credential Manager，Linux 需要 Secret Service。"
    )
}
