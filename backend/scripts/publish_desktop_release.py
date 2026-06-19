from pathlib import Path
import argparse
import hashlib
import json
import mimetypes
import os

import psycopg

from env_loader import load_database_url_from_env_file

ROOT = Path(__file__).resolve().parents[2]
FRONTEND_PACKAGE = ROOT / "sordchat-frontend" / "package.json"
DEFAULT_INSTALLER = ROOT / "sordchat-frontend" / "dist-desktop" / "Volt-Corp-Setup-0.1.0.exe"
CHUNK_SIZE = 1024 * 1024


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL nao configurada. Use a connection string do Neon.")
    return database_url


def get_package_version() -> str:
    if not FRONTEND_PACKAGE.exists():
        return "0.1.0"
    package_data = json.loads(FRONTEND_PACKAGE.read_text(encoding="utf-8"))
    return package_data.get("version") or "0.1.0"


def ensure_table(conn) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS desktop_releases (
          id SERIAL PRIMARY KEY,
          version VARCHAR(80) NOT NULL,
          platform VARCHAR(40) NOT NULL DEFAULT 'windows',
          filename VARCHAR(255) NOT NULL,
          content_type VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
          file_size BIGINT NOT NULL,
          sha256 VARCHAR(64) NOT NULL,
          binary_data BYTEA,
          storage_mode VARCHAR(40) NOT NULL DEFAULT 'inline',
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    conn.execute("ALTER TABLE desktop_releases ALTER COLUMN binary_data DROP NOT NULL")
    conn.execute(
        "ALTER TABLE desktop_releases ADD COLUMN IF NOT EXISTS storage_mode VARCHAR(40) NOT NULL DEFAULT 'inline'"
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS desktop_release_chunks (
          release_id INTEGER NOT NULL REFERENCES desktop_releases(id) ON DELETE CASCADE,
          chunk_index INTEGER NOT NULL,
          data BYTEA NOT NULL,
          PRIMARY KEY (release_id, chunk_index)
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS ix_desktop_releases_platform ON desktop_releases (platform)")
    conn.execute("CREATE INDEX IF NOT EXISTS ix_desktop_releases_is_active ON desktop_releases (is_active)")
    conn.execute("CREATE INDEX IF NOT EXISTS ix_desktop_releases_created_at ON desktop_releases (created_at DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS ix_desktop_release_chunks_release_id ON desktop_release_chunks (release_id)")


def hash_release_file(installer_path: Path) -> str:
    digest = hashlib.sha256()
    with installer_path.open("rb") as file:
        for chunk in iter(lambda: file.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def insert_release_chunks(conn, release_id: int, installer_path: Path) -> int:
    chunk_count = 0
    with installer_path.open("rb") as file:
        for chunk_index, chunk in enumerate(iter(lambda: file.read(CHUNK_SIZE), b"")):
            conn.execute(
                """
                INSERT INTO desktop_release_chunks (release_id, chunk_index, data)
                VALUES (%s, %s, %s)
                """,
                (release_id, chunk_index, chunk),
            )
            chunk_count += 1
    return chunk_count


def main() -> int:
    parser = argparse.ArgumentParser(description="Publica o instalador desktop do Volt Corp no banco.")
    parser.add_argument(
        "installer",
        nargs="?",
        default=str(DEFAULT_INSTALLER),
        help="Caminho do instalador .exe gerado pelo electron-builder.",
    )
    parser.add_argument("--version", default=get_package_version(), help="Versao publicada.")
    parser.add_argument("--platform", default="windows", help="Plataforma da release.")
    args = parser.parse_args()

    load_database_url_from_env_file()
    installer_path = Path(args.installer).resolve()
    if not installer_path.exists():
        raise FileNotFoundError(f"Instalador nao encontrado: {installer_path}")

    digest = hash_release_file(installer_path)
    content_type = mimetypes.guess_type(installer_path.name)[0] or "application/vnd.microsoft.portable-executable"

    with psycopg.connect(get_database_url()) as conn:
        with conn.transaction():
            ensure_table(conn)
            conn.execute(
                "UPDATE desktop_releases SET is_active = FALSE WHERE platform = %s AND is_active = TRUE",
                (args.platform,),
            )
            row = conn.execute(
                """
                INSERT INTO desktop_releases
                  (version, platform, filename, content_type, file_size, sha256, binary_data, storage_mode, is_active)
                VALUES
                  (%s, %s, %s, %s, %s, %s, NULL, 'chunks', TRUE)
                RETURNING id, created_at
                """,
                (
                    args.version,
                    args.platform,
                    installer_path.name,
                    content_type,
                    installer_path.stat().st_size,
                    digest,
                ),
            ).fetchone()
            chunk_count = insert_release_chunks(conn, row[0], installer_path)

    print(
        f"Release publicada: id={row[0]} version={args.version} "
        f"file={installer_path.name} size={installer_path.stat().st_size} chunks={chunk_count} "
        f"sha256={digest} created_at={row[1]}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
