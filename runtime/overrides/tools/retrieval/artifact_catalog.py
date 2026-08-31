"""Fast local FTS catalog for knowledge documents and user file metadata."""
from __future__ import annotations

import hashlib
import html
import json
import os
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

from neyra_state import SessionDB
from tools.retrieval.donor_history import redact_sensitive_text


@dataclass(frozen=True)
class RootSpec:
    layer: str
    path: Path
    index_content: bool = False
    exclude_relative_prefixes: Tuple[str, ...] = ()


_TEXT_EXTENSIONS = {".md", ".txt", ".html", ".htm", ".json", ".csv", ".yaml", ".yml"}
_RESTRICTED_PARTS = (
    re.compile(r"(^|[._-])env($|[._-])", re.I),
    re.compile(r"credential|private[_-]?key|id_rsa|id_ed25519|cookies?|oauth[_-]?token|secrets?", re.I),
)
_SCHEMA = """
CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    layer TEXT NOT NULL,
    root TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    title TEXT NOT NULL,
    extension TEXT,
    size_bytes INTEGER NOT NULL,
    mtime_ns INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    content_indexed INTEGER NOT NULL DEFAULT 0,
    sensitivity TEXT NOT NULL DEFAULT 'normal',
    UNIQUE(root, relative_path)
);
CREATE INDEX idx_files_layer ON files(layer);
CREATE INDEX idx_files_sha ON files(sha256);
CREATE VIRTUAL TABLE files_fts USING fts5(title, relative_path, body);
"""


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _is_restricted(relative_path: str) -> bool:
    return any(pattern.search(relative_path) for pattern in _RESTRICTED_PARTS)


def _extract_text(path: Path, max_bytes: int) -> str:
    if path.suffix.lower() not in _TEXT_EXTENSIONS or path.stat().st_size > max_bytes:
        return ""
    raw = path.read_bytes()
    text = None
    for encoding in ("utf-8", "utf-8-sig", "utf-16", "cp1251"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        return ""
    if path.suffix.lower() in {".html", ".htm"}:
        text = re.sub(r"(?is)<(script|style|form)\b.*?</\1>", " ", text)
        text = re.sub(r"(?s)<[^>]+>", " ", text)
        text = html.unescape(text)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", text)
    return redact_sensitive_text(text)[0]


class ArtifactCatalog:
    def __init__(self, path: Path | str):
        self.path = Path(path)
        self._conn = sqlite3.connect(f"file:{self.path}?mode=ro", uri=True)
        self._conn.row_factory = sqlite3.Row

    def close(self) -> None:
        self._conn.close()

    @classmethod
    def build(
        cls,
        path: Path | str,
        roots: Iterable[RootSpec],
        *,
        max_content_bytes: int = 4 * 1024 * 1024,
    ) -> Dict[str, int]:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_name(path.name + f".tmp-{os.getpid()}")
        for suffix in ("", "-wal", "-shm"):
            try:
                Path(str(temp) + suffix).unlink()
            except FileNotFoundError:
                pass
        conn = sqlite3.connect(temp)
        conn.execute("PRAGMA journal_mode=DELETE")
        conn.executescript(_SCHEMA)
        stats = {"files": 0, "content_indexed": 0, "restricted": 0, "errors": 0}
        try:
            with conn:
                for spec in roots:
                    root = Path(spec.path).resolve()
                    if not root.exists():
                        continue
                    items = [root] if root.is_file() else sorted(root.rglob("*"))
                    for item in items:
                        try:
                            if not item.is_file() or item.is_symlink():
                                continue
                            resolved = item.resolve()
                            if root.is_dir() and root not in resolved.parents:
                                continue
                            relative = (
                                item.name if root.is_file()
                                else item.relative_to(root).as_posix()
                            )
                            if any(
                                relative == prefix or relative.startswith(prefix + "/")
                                for prefix in spec.exclude_relative_prefixes
                            ):
                                continue
                            restricted = _is_restricted(relative)
                            body = ""
                            if spec.index_content and not restricted:
                                body = _extract_text(item, max_content_bytes)
                            stat = item.stat()
                            digest = _sha256(item)
                            cursor = conn.execute(
                                """INSERT INTO files (layer, root, relative_path, title, extension,
                                   size_bytes, mtime_ns, sha256, content_indexed, sensitivity)
                                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                                (spec.layer, str(root), relative, item.stem, item.suffix.lower(),
                                 stat.st_size, stat.st_mtime_ns, digest, int(bool(body)),
                                 "restricted" if restricted else "normal"),
                            )
                            if restricted:
                                stats["restricted"] += 1
                            else:
                                safe_title = redact_sensitive_text(item.stem)[0]
                                safe_relative = redact_sensitive_text(relative.replace("_", " "))[0]
                                conn.execute(
                                    "INSERT INTO files_fts(rowid, title, relative_path, body) VALUES (?, ?, ?, ?)",
                                    (cursor.lastrowid, safe_title, safe_relative, body),
                                )
                            stats["files"] += 1
                            stats["content_indexed"] += int(bool(body))
                        except (OSError, UnicodeError, sqlite3.Error):
                            stats["errors"] += 1
            if conn.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise sqlite3.DatabaseError("artifact catalog quick_check failed")
        except BaseException:
            conn.close()
            try:
                temp.unlink()
            except FileNotFoundError:
                pass
            raise
        conn.close()
        os.chmod(temp, 0o600)
        os.replace(temp, path)
        return stats

    def search(self, query: str, *, layers: Iterable[str] | None = None, limit: int = 10) -> List[Dict[str, Any]]:
        query = SessionDB._sanitize_fts5_query(query or "")
        if not query:
            return []
        limit = max(1, min(int(limit), 50))
        clauses = ["files_fts MATCH ?", "f.sensitivity = 'normal'"]
        params: List[Any] = [query]
        layer_list = list(layers or [])
        if layer_list:
            clauses.append("f.layer IN (%s)" % ",".join("?" for _ in layer_list))
            params.extend(layer_list)
        params.append(limit)
        sql = f"""
            SELECT f.id, f.layer, f.root, f.relative_path, f.title, f.extension,
                   f.size_bytes, f.mtime_ns, f.sha256, f.content_indexed,
                   snippet(files_fts, 2, '>>>', '<<<', '…', 36) AS snippet,
                   bm25(files_fts, 3.0, 2.0, 1.0) AS rank
            FROM files_fts JOIN files f ON f.id = files_fts.rowid
            WHERE {' AND '.join(clauses)}
            ORDER BY rank LIMIT ?
        """
        return [dict(row) for row in self._conn.execute(sql, params).fetchall()]
