use crate::ai;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    io::{BufReader, Read},
    path::{Component, Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
};

pub const LOCAL_PROVIDER_ID: &str = "local";
pub const LOCAL_MODEL_ID: &str = "intfloat/multilingual-e5-small";
pub const LOCAL_MODEL_REVISION: &str = "614241f622f53c4eeff9890bdc4f31cfecc418b3";
pub const LOCAL_DOWNLOAD_SOURCE_MODELSCOPE: &str = "modelscope";
pub const LOCAL_DOWNLOAD_SOURCE_HUGGING_FACE: &str = "huggingface";
pub const LOCAL_DIMENSIONS: usize = 384;
pub const LOCAL_MAX_LENGTH: usize = 512;
pub const LOCAL_BATCH_SIZE: usize = 16;
pub const KNOWLEDGE_TEXT_VERSION: &str = "repository-knowledge-v2";
const QUERY_PREFIX: &str = "query: ";
const PASSAGE_PREFIX: &str = "passage: ";
const LOCAL_SIMILARITY_FLOOR: f32 = 0.70;
const LOCAL_SIMILARITY_RANGE: f32 = 1.0 - LOCAL_SIMILARITY_FLOOR;
const MODEL_CACHE_DIR: &str = "embedding-models";
const READY_MANIFEST_FILE: &str = "ready.json";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalModelDownloadSource {
    ModelScope,
    HuggingFace,
}

impl LocalModelDownloadSource {
    pub fn parse(value: Option<&str>) -> Result<Self, String> {
        match value.map(str::trim).filter(|value| !value.is_empty()) {
            None | Some(LOCAL_DOWNLOAD_SOURCE_MODELSCOPE) => Ok(Self::ModelScope),
            Some(LOCAL_DOWNLOAD_SOURCE_HUGGING_FACE) => Ok(Self::HuggingFace),
            Some(value) => Err(format!("不支持的本地模型下载源：{value}")),
        }
    }

    pub fn display_name(self) -> &'static str {
        match self {
            Self::ModelScope => "ModelScope 国内源",
            Self::HuggingFace => "Hugging Face 官方源",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
/// 描述一个可持久化隔离的 Embedding 模型与文本协议。
pub struct EmbeddingProfile {
    pub provider: String,
    pub model: String,
    pub revision: String,
    pub dimensions: usize,
    pub max_length: usize,
    pub query_prefix: String,
    pub passage_prefix: String,
    pub knowledge_text_version: String,
}

impl EmbeddingProfile {
    pub fn profile_id(&self) -> String {
        let serialized = serde_json::to_vec(self).expect("Embedding profile 应可序列化");
        format!("embedding-{:x}", Sha256::digest(serialized))
    }
}

pub fn local_profile() -> EmbeddingProfile {
    EmbeddingProfile {
        provider: LOCAL_PROVIDER_ID.to_owned(),
        model: LOCAL_MODEL_ID.to_owned(),
        revision: LOCAL_MODEL_REVISION.to_owned(),
        dimensions: LOCAL_DIMENSIONS,
        max_length: LOCAL_MAX_LENGTH,
        query_prefix: QUERY_PREFIX.to_owned(),
        passage_prefix: PASSAGE_PREFIX.to_owned(),
        knowledge_text_version: KNOWLEDGE_TEXT_VERSION.to_owned(),
    }
}

pub fn remote_profile(config: &ai::EmbeddingRequestConfig) -> EmbeddingProfile {
    let endpoint = config
        .base_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("https://api.openai.com/v1");
    EmbeddingProfile {
        provider: config.provider.trim().to_ascii_lowercase(),
        model: config.model.trim().to_owned(),
        revision: format!("remote-api:{endpoint}"),
        dimensions: config.dimensions,
        max_length: 0,
        query_prefix: String::new(),
        passage_prefix: String::new(),
        knowledge_text_version: "repository-knowledge-v1".to_owned(),
    }
}

pub fn profile_for_config(config: &ai::EmbeddingRequestConfig) -> EmbeddingProfile {
    if config
        .provider
        .trim()
        .eq_ignore_ascii_case(LOCAL_PROVIDER_ID)
    {
        local_profile()
    } else {
        remote_profile(config)
    }
}

/// 将 E5 集中的原始余弦分数校准为用户可理解的 0 到 1 相关度。
pub fn normalize_local_similarity(raw_similarity: f32) -> f32 {
    ((raw_similarity - LOCAL_SIMILARITY_FLOOR) / LOCAL_SIMILARITY_RANGE).clamp(0.0, 1.0)
}

/// 将用户设置的本地相关度阈值还原为 zvec 使用的原始余弦阈值。
pub fn raw_local_similarity_threshold(normalized_threshold: f32) -> f32 {
    LOCAL_SIMILARITY_FLOOR + normalized_threshold.clamp(0.0, 1.0) * LOCAL_SIMILARITY_RANGE
}

/// 本地与远程 Embedding Provider 必须实现的统一端口。
pub trait EmbeddingProviderPort: Send + Sync {
    fn descriptor(&self) -> EmbeddingProfile;
    fn prepare(&self, cache_dir: &Path, on_stage: &dyn Fn(&str)) -> Result<(), String>;
    fn embed_query(&self, text: &str) -> Result<Vec<f32>, String>;
    fn embed_passages(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String>;
}

/// 负责模型准备和查询/知识文本向量生成的应用服务。
pub struct EmbeddingService {
    provider: Arc<dyn EmbeddingProviderPort>,
    cache_dir: PathBuf,
    download_source: LocalModelDownloadSource,
}

impl EmbeddingService {
    pub fn new(config: ai::EmbeddingRequestConfig, cache_dir: PathBuf) -> Self {
        let download_source = LocalModelDownloadSource::parse(config.download_source.as_deref())
            .unwrap_or(LocalModelDownloadSource::ModelScope);
        Self {
            provider: provider_for_config(config),
            cache_dir,
            download_source,
        }
    }

    pub fn descriptor(&self) -> EmbeddingProfile {
        self.provider.descriptor()
    }

    pub fn prepare(&self, on_stage: &dyn Fn(&str)) -> Result<(), String> {
        if self.provider.descriptor().provider == LOCAL_PROVIDER_ID {
            local_provider().prepare_with_source(&self.cache_dir, self.download_source, on_stage)
        } else {
            self.provider.prepare(&self.cache_dir, on_stage)
        }
    }

    pub fn embed_query(&self, text: &str) -> Result<Vec<f32>, String> {
        self.provider.embed_query(text)
    }

    pub fn embed_passages(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        self.provider.embed_passages(texts)
    }
}

pub struct LocalEmbeddingProvider {
    loaded: Mutex<bool>,
    prepare_lock: Mutex<()>,
}

impl LocalEmbeddingProvider {
    fn new() -> Self {
        Self {
            loaded: Mutex::new(false),
            prepare_lock: Mutex::new(()),
        }
    }

    pub fn is_loaded(&self) -> bool {
        self.loaded.lock().map(|loaded| *loaded).unwrap_or(false)
    }

    pub fn unload(&self) -> Result<(), String> {
        let _prepare_guard = self
            .prepare_lock
            .lock()
            .map_err(|_| "本地 Embedding 准备锁已损坏".to_owned())?;
        self.clear_model()
    }

    fn clear_model(&self) -> Result<(), String> {
        *self
            .loaded
            .lock()
            .map_err(|_| "本地 Embedding 模型状态已损坏".to_owned())? = false;
        Ok(())
    }

    pub fn prepare_with_source(
        &self,
        _cache_dir: &Path,
        _source: LocalModelDownloadSource,
        _on_stage: &dyn Fn(&str),
    ) -> Result<(), String> {
        Err("本地 Embedding 在此平台不可用".to_owned())
    }
}

impl EmbeddingProviderPort for LocalEmbeddingProvider {
    fn descriptor(&self) -> EmbeddingProfile {
        local_profile()
    }

    fn prepare(&self, cache_dir: &Path, on_stage: &dyn Fn(&str)) -> Result<(), String> {
        self.prepare_with_source(cache_dir, LocalModelDownloadSource::ModelScope, on_stage)
    }

    fn embed_query(&self, _text: &str) -> Result<Vec<f32>, String> {
        Err("本地 Embedding 在此平台不可用".to_owned())
    }

    fn embed_passages(&self, _texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        Err("本地 Embedding 在此平台不可用".to_owned())
    }
}

pub struct RemoteEmbeddingProvider {
    config: ai::EmbeddingRequestConfig,
}

impl RemoteEmbeddingProvider {
    pub fn new(config: ai::EmbeddingRequestConfig) -> Self {
        Self { config }
    }
}

impl EmbeddingProviderPort for RemoteEmbeddingProvider {
    fn descriptor(&self) -> EmbeddingProfile {
        remote_profile(&self.config)
    }

    fn prepare(&self, _cache_dir: &Path, _on_stage: &dyn Fn(&str)) -> Result<(), String> {
        Ok(())
    }

    fn embed_query(&self, text: &str) -> Result<Vec<f32>, String> {
        ai::embed_text(&self.config, text).map(|result| result.vector)
    }

    fn embed_passages(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        texts
            .iter()
            .map(|text| ai::embed_text(&self.config, text).map(|result| result.vector))
            .collect()
    }
}

pub fn local_provider() -> Arc<LocalEmbeddingProvider> {
    static PROVIDER: OnceLock<Arc<LocalEmbeddingProvider>> = OnceLock::new();
    PROVIDER
        .get_or_init(|| Arc::new(LocalEmbeddingProvider::new()))
        .clone()
}

pub fn provider_for_config(config: ai::EmbeddingRequestConfig) -> Arc<dyn EmbeddingProviderPort> {
    if config
        .provider
        .trim()
        .eq_ignore_ascii_case(LOCAL_PROVIDER_ID)
    {
        local_provider()
    } else {
        Arc::new(RemoteEmbeddingProvider::new(config))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
/// 向设置页公开的 Embedding 下载、加载和索引状态。
pub struct EmbeddingRuntimeStatus {
    pub account_id: String,
    pub enabled: bool,
    pub provider: String,
    pub state: String,
    pub model_ready: bool,
    pub model: String,
    pub revision: Option<String>,
    pub profile_id: String,
    pub dimensions: usize,
    pub cache_bytes: u64,
    pub indexed_count: usize,
    pub total_count: usize,
    pub failed_count: usize,
    pub message: String,
    pub can_retry: bool,
}

impl EmbeddingRuntimeStatus {
    pub fn local(account_id: &str, state: &str, message: impl Into<String>) -> Self {
        let profile = local_profile();
        Self {
            account_id: account_id.to_owned(),
            enabled: state != "disabled",
            provider: profile.provider.clone(),
            state: state.to_owned(),
            model_ready: false,
            model: profile.model.clone(),
            revision: Some(profile.revision.clone()),
            profile_id: profile.profile_id(),
            dimensions: profile.dimensions,
            cache_bytes: 0,
            indexed_count: 0,
            total_count: 0,
            failed_count: 0,
            message: message.into(),
            can_retry: state == "missing" || state == "partial" || state == "error",
        }
    }
}

#[derive(Default)]
struct RuntimeRegistry {
    statuses: HashMap<String, EmbeddingRuntimeStatus>,
    running_account: Option<String>,
}

fn runtime_registry() -> &'static Mutex<RuntimeRegistry> {
    static REGISTRY: OnceLock<Mutex<RuntimeRegistry>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(RuntimeRegistry::default()))
}

pub fn runtime_status(account_id: &str) -> Option<EmbeddingRuntimeStatus> {
    runtime_registry()
        .lock()
        .ok()
        .and_then(|registry| registry.statuses.get(account_id).cloned())
}

pub fn set_runtime_status(
    account_id: &str,
    status: EmbeddingRuntimeStatus,
) -> Result<EmbeddingRuntimeStatus, String> {
    runtime_registry()
        .lock()
        .map_err(|_| "Embedding 运行状态已损坏".to_owned())?
        .statuses
        .insert(account_id.to_owned(), status.clone());
    Ok(status)
}

pub fn begin_runtime_job(account_id: &str) -> Result<(), String> {
    let mut registry = runtime_registry()
        .lock()
        .map_err(|_| "Embedding 运行状态已损坏".to_owned())?;
    if registry.running_account.is_some() {
        return Err("本地 Embedding 正在准备，请等待当前任务完成".to_owned());
    }
    registry.running_account = Some(account_id.to_owned());
    Ok(())
}

pub fn finish_runtime_job(account_id: &str) {
    if let Ok(mut registry) = runtime_registry().lock() {
        if registry.running_account.as_deref() == Some(account_id) {
            registry.running_account = None;
        }
    }
}

pub fn runtime_job_is_running() -> bool {
    runtime_registry()
        .lock()
        .map(|registry| registry.running_account.is_some())
        .unwrap_or(true)
}

pub fn local_cache_root(app_cache_dir: &Path) -> PathBuf {
    app_cache_dir
        .join(MODEL_CACHE_DIR)
        .join(local_profile().profile_id())
}

pub fn local_cache_size(app_cache_dir: &Path) -> u64 {
    directory_size(&local_cache_root(app_cache_dir)).unwrap_or(0)
}

pub fn local_model_is_ready(app_cache_dir: &Path) -> bool {
    local_cache_root(app_cache_dir)
        .join(READY_MANIFEST_FILE)
        .is_file()
}

pub fn delete_local_model(app_cache_dir: &Path) -> Result<(), String> {
    let provider = local_provider();
    let _prepare_guard = provider
        .prepare_lock
        .lock()
        .map_err(|_| "本地 Embedding 准备锁已损坏".to_owned())?;
    provider.clear_model()?;
    let root = local_cache_root(app_cache_dir);
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|error| format!("本地模型删除失败：{error}"))?;
    }
    Ok(())
}

#[derive(Debug)]
struct PreparedArtifacts {
    onnx: PathBuf,
    tokenizer: PathBuf,
    config: PathBuf,
    special_tokens_map: PathBuf,
    tokenizer_config: PathBuf,
}

#[derive(Debug, Clone, Copy)]
struct ArtifactSpec {
    path: &'static str,
    size: u64,
    sha256: &'static str,
}

const ARTIFACTS: &[ArtifactSpec] = &[
    ArtifactSpec {
        path: "onnx/model.onnx",
        size: 470_268_510,
        sha256: "ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665",
    },
    ArtifactSpec {
        path: "tokenizer.json",
        size: 17_082_730,
        sha256: "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39",
    },
    ArtifactSpec {
        path: "config.json",
        size: 655,
        sha256: "69137736cab8b8903a07fe8afaafdda25aac55415a12a55d1bffa9f581abf959",
    },
    ArtifactSpec {
        path: "special_tokens_map.json",
        size: 167,
        sha256: "d05497f1da52c5e09554c0cd874037a083e1dc1b9cfd48034d1c717f1afc07a7",
    },
    ArtifactSpec {
        path: "tokenizer_config.json",
        size: 443,
        sha256: "a1d6bc8734a6f635dc158508bef000f8e2e5a759c7d92f984b2c86e5ff53425b",
    },
];

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReadyManifest {
    profile_id: String,
    revision: String,
    files: Vec<ReadyArtifact>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReadyArtifact {
    source_path: String,
    relative_path: String,
    size: u64,
    sha256: String,
}

#[allow(dead_code)]
fn clear_invalid_local_cache(root: &Path) -> Result<(), String> {
    for file_name in [READY_MANIFEST_FILE, "ready.json.tmp"] {
        let path = root.join(file_name);
        if path.exists() {
            fs::remove_file(&path)
                .map_err(|error| format!("损坏模型标记清理失败（{}）：{error}", path.display()))?;
        }
    }
    for cache_name in ["hf", "modelscope"] {
        let download_cache = root.join(cache_name);
        if download_cache.exists() {
            fs::remove_dir_all(&download_cache).map_err(|error| {
                format!(
                    "损坏模型缓存清理失败（{}）：{error}",
                    download_cache.display()
                )
            })?;
        }
    }
    Ok(())
}

#[allow(dead_code)]
fn verified_ready_artifacts(root: &Path) -> Result<PreparedArtifacts, String> {
    let content = fs::read(root.join(READY_MANIFEST_FILE))
        .map_err(|error| format!("本地模型尚未准备完成：{error}"))?;
    let ready = serde_json::from_slice::<ReadyManifest>(&content)
        .map_err(|error| format!("本地模型完成标记损坏：{error}"))?;
    if ready.profile_id != local_profile().profile_id() || ready.revision != LOCAL_MODEL_REVISION {
        return Err("本地模型版本已变化，需要重新下载".to_owned());
    }
    let mut paths = HashMap::new();
    for expected in ARTIFACTS {
        let record = ready
            .files
            .iter()
            .find(|file| file.source_path == expected.path)
            .ok_or_else(|| format!("本地模型缺少工件记录：{}", expected.path))?;
        let path = safe_cache_path(root, &record.relative_path)?;
        verify_artifact(&path, *expected)?;
        paths.insert(expected.path, path);
    }
    Ok(PreparedArtifacts {
        onnx: take_path(&mut paths, "onnx/model.onnx")?,
        tokenizer: take_path(&mut paths, "tokenizer.json")?,
        config: take_path(&mut paths, "config.json")?,
        special_tokens_map: take_path(&mut paths, "special_tokens_map.json")?,
        tokenizer_config: take_path(&mut paths, "tokenizer_config.json")?,
    })
}

#[allow(dead_code)]
fn write_ready_manifest(root: &Path, ready: &ReadyManifest) -> Result<(), String> {
    let target = root.join(READY_MANIFEST_FILE);
    let temporary = root.join("ready.json.tmp");
    let content = serde_json::to_vec_pretty(ready)
        .map_err(|error| format!("本地模型完成标记序列化失败：{error}"))?;
    fs::write(&temporary, content).map_err(|error| format!("本地模型完成标记写入失败：{error}"))?;
    if target.exists() {
        fs::remove_file(&target).map_err(|error| format!("旧模型完成标记清理失败：{error}"))?;
    }
    fs::rename(temporary, target).map_err(|error| format!("本地模型完成标记激活失败：{error}"))
}

#[allow(dead_code)]
fn verify_artifact(path: &Path, expected: ArtifactSpec) -> Result<(), String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("模型工件 {} 无法读取：{error}", expected.path))?;
    if metadata.len() != expected.size {
        return Err(format!(
            "模型工件 {} 大小校验失败：预期 {} 字节，实际 {} 字节",
            expected.path,
            expected.size,
            metadata.len()
        ));
    }
    let file = fs::File::open(path)
        .map_err(|error| format!("模型工件 {} 无法打开：{error}", expected.path))?;
    let mut reader = BufReader::with_capacity(1024 * 1024, file);
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; 1024 * 1024];
    loop {
        let count = reader
            .read(&mut buffer)
            .map_err(|error| format!("模型工件 {} 校验读取失败：{error}", expected.path))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    let actual = format!("{:x}", hasher.finalize());
    if actual != expected.sha256 {
        return Err(format!("模型工件 {} 完整性校验失败", expected.path));
    }
    Ok(())
}

fn safe_cache_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let relative = Path::new(relative);
    if relative.is_absolute()
        || relative.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("本地模型完成标记包含非法路径".to_owned());
    }
    Ok(root.join(relative))
}

fn take_path(
    paths: &mut HashMap<&'static str, PathBuf>,
    key: &'static str,
) -> Result<PathBuf, String> {
    paths
        .remove(key)
        .ok_or_else(|| format!("本地模型缺少工件：{key}"))
}

#[allow(dead_code)]
fn validate_vectors(
    vectors: Vec<Vec<f32>>,
    expected_count: usize,
) -> Result<Vec<Vec<f32>>, String> {
    if vectors.len() != expected_count {
        return Err(format!(
            "本地模型返回向量数量不匹配：预期 {expected_count}，实际 {}",
            vectors.len()
        ));
    }
    if vectors.iter().any(|vector| {
        vector.len() != LOCAL_DIMENSIONS || vector.iter().any(|value| !value.is_finite())
    }) {
        return Err("本地模型返回了维度错误或包含无效数值的向量".to_owned());
    }
    Ok(vectors)
}

fn directory_size(path: &Path) -> Result<u64, String> {
    if !path.exists() {
        return Ok(0);
    }
    let mut total = 0_u64;
    for entry in fs::read_dir(path).map_err(|error| format!("模型缓存读取失败：{error}"))?
    {
        let entry = entry.map_err(|error| format!("模型缓存读取失败：{error}"))?;
        let metadata = entry
            .metadata()
            .map_err(|error| format!("模型缓存信息读取失败：{error}"))?;
        total = total.saturating_add(if metadata.is_dir() {
            directory_size(&entry.path())?
        } else {
            metadata.len()
        });
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn local_profile_id_is_stable_and_protocol_sensitive() {
        let profile = local_profile();
        assert_eq!(profile.profile_id(), local_profile().profile_id());

        let mut changed = profile.clone();
        changed.query_prefix = "search: ".to_owned();
        assert_ne!(profile.profile_id(), changed.profile_id());
    }

    #[test]
    fn local_manifest_has_unique_paths_and_expected_size() {
        let paths = ARTIFACTS
            .iter()
            .map(|artifact| artifact.path)
            .collect::<HashSet<_>>();
        assert_eq!(paths.len(), ARTIFACTS.len());
        assert_eq!(
            ARTIFACTS.iter().map(|artifact| artifact.size).sum::<u64>(),
            487_352_505
        );
    }

    #[test]
    fn local_download_source_defaults_to_modelscope_and_keeps_official_option() {
        assert_eq!(
            LocalModelDownloadSource::parse(None).expect("默认下载源应有效"),
            LocalModelDownloadSource::ModelScope
        );
        assert_eq!(
            LocalModelDownloadSource::parse(Some(LOCAL_DOWNLOAD_SOURCE_HUGGING_FACE))
                .expect("官方下载源应有效"),
            LocalModelDownloadSource::HuggingFace
        );
        assert!(LocalModelDownloadSource::parse(Some("unknown")).is_err());
    }

    #[test]
    fn e5_prefixes_and_batch_validation_preserve_protocol_order() {
        assert_eq!(QUERY_PREFIX, "query: ");
        assert_eq!(PASSAGE_PREFIX, "passage: ");
        let first = vec![0.25; LOCAL_DIMENSIONS];
        let second = vec![0.75; LOCAL_DIMENSIONS];
        let validated = validate_vectors(vec![first.clone(), second.clone()], 2)
            .expect("合法批量向量应通过校验");
        assert_eq!(validated, vec![first, second]);
        assert!((normalize_local_similarity(0.94) - 0.80).abs() < f32::EPSILON);
        assert!((raw_local_similarity_threshold(0.80) - 0.94).abs() < f32::EPSILON);
    }

    #[test]
    fn ready_manifest_rejects_parent_paths() {
        assert!(safe_cache_path(Path::new("/tmp/cache"), "../model.onnx").is_err());
        assert!(safe_cache_path(Path::new("/tmp/cache"), "hf/model.onnx").is_ok());
    }

    #[test]
    fn invalid_local_cache_cleanup_removes_ready_marker_and_downloads() {
        let root = std::env::temp_dir().join(format!(
            "gsat-invalid-embedding-cache-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("hf")).expect("应能创建损坏缓存目录");
        fs::create_dir_all(root.join("modelscope")).expect("应能创建国内源损坏缓存目录");
        fs::write(root.join(READY_MANIFEST_FILE), b"invalid").expect("应能写入损坏完成标记");
        fs::write(root.join("ready.json.tmp"), b"partial").expect("应能写入临时完成标记");
        fs::write(root.join("hf").join("artifact"), b"invalid").expect("应能写入损坏工件");
        fs::write(root.join("modelscope").join("artifact"), b"invalid")
            .expect("应能写入国内源损坏工件");

        clear_invalid_local_cache(&root).expect("应能清理损坏模型缓存");

        assert!(!root.join(READY_MANIFEST_FILE).exists());
        assert!(!root.join("ready.json.tmp").exists());
        assert!(!root.join("hf").exists());
        assert!(!root.join("modelscope").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn runtime_job_is_single_flight_per_account() {
        let account_id = "single-flight-test";
        assert!(begin_runtime_job(account_id).is_ok());
        assert!(begin_runtime_job(account_id).is_err());
        assert!(begin_runtime_job("another-account").is_err());
        assert!(runtime_job_is_running());
        finish_runtime_job(account_id);
        assert!(!runtime_job_is_running());
        assert!(begin_runtime_job(account_id).is_ok());
        finish_runtime_job(account_id);
    }
}
