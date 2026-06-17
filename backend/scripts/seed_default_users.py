from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sordchat_fixed import create_default_users  # noqa: E402


if __name__ == "__main__":
    create_default_users()
    print("Usuarios padrao verificados.")
