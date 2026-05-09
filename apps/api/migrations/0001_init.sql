-- Projects: one row per design.md document
CREATE TABLE projects (
  id              TEXT PRIMARY KEY,
  edit_token_hash TEXT NOT NULL,
  schema_version  INTEGER NOT NULL DEFAULT 1,
  state           TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER
);

CREATE INDEX idx_projects_updated ON projects(updated_at);
CREATE INDEX idx_projects_deleted ON projects(deleted_at);
