import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.errors import FileTooLarge

CHUNK_SIZE = 1024 * 1024


class LocalStorage:
    """Guarda os arquivos em disco com nome gerado (UUID), nunca o nome enviado pelo cliente.

    Mantida atrás de uma interface simples (save/path/delete) para que uma
    implementação S3 possa substituí-la sem alterar as rotas.
    """

    def __init__(self, base_dir: str, max_bytes: int):
        self.base_dir = Path(base_dir)
        self.max_bytes = max_bytes
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, file: UploadFile) -> tuple[str, int]:
        """Grava o arquivo respeitando o limite de tamanho. Retorna (stored_name, size)."""
        stored_name = uuid.uuid4().hex
        target = self.path(stored_name)
        size = 0
        try:
            with target.open("wb") as out:
                while chunk := file.file.read(CHUNK_SIZE):
                    size += len(chunk)
                    if size > self.max_bytes:
                        raise FileTooLarge(
                            f"O arquivo excede o limite de {self.max_bytes // (1024 * 1024)} MB."
                        )
                    out.write(chunk)
        except Exception:
            target.unlink(missing_ok=True)
            raise
        return stored_name, size

    def path(self, stored_name: str) -> Path:
        return self.base_dir / stored_name

    def delete(self, stored_name: str) -> None:
        self.path(stored_name).unlink(missing_ok=True)
