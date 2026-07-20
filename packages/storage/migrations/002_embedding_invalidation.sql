PRAGMA foreign_keys = ON;

CREATE TRIGGER IF NOT EXISTS invalidate_embedding_after_repository_knowledge_update
AFTER UPDATE OF full_name, description, language, topics_json ON repositories
WHEN OLD.full_name IS NOT NEW.full_name
  OR OLD.description IS NOT NEW.description
  OR OLD.language IS NOT NEW.language
  OR OLD.topics_json IS NOT NEW.topics_json
BEGIN
  DELETE FROM repo_embeddings
  WHERE repo_id = NEW.id AND source_kind = 'repository_knowledge';
END;

CREATE TRIGGER IF NOT EXISTS invalidate_embedding_after_readme_insert
AFTER INSERT ON repo_readmes
BEGIN
  DELETE FROM repo_embeddings
  WHERE repo_id = NEW.repo_id AND source_kind = 'repository_knowledge';
END;

CREATE TRIGGER IF NOT EXISTS invalidate_embedding_after_readme_update
AFTER UPDATE OF raw_markdown, content_hash ON repo_readmes
WHEN OLD.content_hash IS NOT NEW.content_hash
  OR SUBSTR(OLD.raw_markdown, 1, 12000) IS NOT SUBSTR(NEW.raw_markdown, 1, 12000)
BEGIN
  DELETE FROM repo_embeddings
  WHERE repo_id = NEW.repo_id AND source_kind = 'repository_knowledge';
END;

CREATE TRIGGER IF NOT EXISTS invalidate_embedding_after_readme_delete
AFTER DELETE ON repo_readmes
BEGIN
  DELETE FROM repo_embeddings
  WHERE repo_id = OLD.repo_id AND source_kind = 'repository_knowledge';
END;

CREATE TRIGGER IF NOT EXISTS invalidate_embedding_after_ai_document_insert
AFTER INSERT ON repo_ai_documents
BEGIN
  DELETE FROM repo_embeddings
  WHERE repo_id = NEW.repo_id AND source_kind = 'repository_knowledge';
END;

CREATE TRIGGER IF NOT EXISTS invalidate_embedding_after_ai_document_update
AFTER UPDATE OF summary_zh, keywords_json, suggested_tags_json ON repo_ai_documents
WHEN OLD.summary_zh IS NOT NEW.summary_zh
  OR OLD.keywords_json IS NOT NEW.keywords_json
  OR OLD.suggested_tags_json IS NOT NEW.suggested_tags_json
BEGIN
  DELETE FROM repo_embeddings
  WHERE repo_id = NEW.repo_id AND source_kind = 'repository_knowledge';
END;

CREATE TRIGGER IF NOT EXISTS invalidate_embedding_after_ai_document_delete
AFTER DELETE ON repo_ai_documents
BEGIN
  DELETE FROM repo_embeddings
  WHERE repo_id = OLD.repo_id AND source_kind = 'repository_knowledge';
END;

CREATE TRIGGER IF NOT EXISTS invalidate_embedding_after_repository_tag_insert
AFTER INSERT ON repo_tags
BEGIN
  DELETE FROM repo_embeddings
  WHERE repo_id = NEW.repo_id AND source_kind = 'repository_knowledge';
END;

CREATE TRIGGER IF NOT EXISTS invalidate_embedding_after_repository_tag_delete
AFTER DELETE ON repo_tags
BEGIN
  DELETE FROM repo_embeddings
  WHERE repo_id = OLD.repo_id AND source_kind = 'repository_knowledge';
END;

CREATE TRIGGER IF NOT EXISTS invalidate_embedding_after_tag_name_update
AFTER UPDATE OF name ON tags
WHEN OLD.name IS NOT NEW.name
BEGIN
  DELETE FROM repo_embeddings
  WHERE source_kind = 'repository_knowledge'
    AND repo_id IN (SELECT repo_id FROM repo_tags WHERE tag_id = NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS invalidate_embedding_before_tag_delete
BEFORE DELETE ON tags
BEGIN
  DELETE FROM repo_embeddings
  WHERE source_kind = 'repository_knowledge'
    AND repo_id IN (SELECT repo_id FROM repo_tags WHERE tag_id = OLD.id);
END;

INSERT OR IGNORE INTO schema_migrations(version, name)
VALUES ('002', 'embedding_invalidation');
