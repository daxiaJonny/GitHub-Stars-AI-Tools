use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone)]
pub struct RepositoryVectorRecord {
    pub account_id: String,
    pub repo_id: String,
    pub source_hash: String,
    pub model: String,
    pub vector: Vec<f32>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct VectorSearchHit {
    pub repo_id: String,
    pub score: f32,
}

#[derive(Debug, Clone)]
pub struct VectorSearchRequest {
    pub account_id: String,
    pub model: String,
    pub vector: Vec<f32>,
    pub limit: usize,
    pub min_score: f32,
}

#[derive(Debug, Clone)]
pub struct ZvecRepositoryIndex {
    #[allow(dead_code)]
    base_dir: PathBuf,
}

impl ZvecRepositoryIndex {
    pub fn from_app_handle(app_handle: &tauri::AppHandle) -> Result<Self, String> {
        let base_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|error| format!("无法定位向量索引目录：{error}"))?
            .join("vector-index");
        Ok(Self::new(base_dir))
    }

    pub fn new(base_dir: PathBuf) -> Self {
        Self { base_dir }
    }

    pub fn replace_bucket(
        &self,
        _account_id: &str,
        _model: &str,
        _dimensions: usize,
        _records: &[RepositoryVectorRecord],
    ) -> Result<(), String> {
        Ok(())
    }

    pub fn search(&self, _request: &VectorSearchRequest) -> Result<Vec<VectorSearchHit>, String> {
        Ok(Vec::new())
    }

    pub fn count(
        &self,
        _account_id: &str,
        _model: &str,
        _dimensions: usize,
    ) -> Result<usize, String> {
        Ok(0)
    }

    pub fn bucket_fingerprint(
        &self,
        _account_id: &str,
        _model: &str,
        _dimensions: usize,
    ) -> Result<Option<String>, String> {
        Ok(None)
    }

    pub fn reset_all(&self) -> Result<(), String> {
        Ok(())
    }
}
