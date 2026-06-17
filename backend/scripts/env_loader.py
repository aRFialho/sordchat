from pathlib import Path
import os


def load_database_url_from_env_file() -> None:
    if os.getenv("DATABASE_URL"):
        return

    candidates = [
        Path(__file__).resolve().parents[2] / ".env",
        Path(__file__).resolve().parents[1] / ".env",
    ]

    for env_path in candidates:
        if not env_path.exists():
            continue

        content = env_path.read_text(encoding="utf-8").strip()
        if not content:
            continue

        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            if line.startswith(("postgres://", "postgresql://")):
                os.environ["DATABASE_URL"] = line
                return

            if "=" in line:
                key, value = line.split("=", 1)
                if key.strip() == "DATABASE_URL":
                    os.environ["DATABASE_URL"] = value.strip().strip('"').strip("'")
                    return
