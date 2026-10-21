from sqlalchemy import LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AttachmentBlob(Base):
    """Conteúdo dos anexos quando STORAGE_BACKEND=database.

    Fica separado da tabela `attachments` (metadados) e sem chave estrangeira:
    o armazenamento de arquivos é independente do restante do modelo, como no
    backend de disco.
    """

    __tablename__ = "attachment_blobs"

    stored_name: Mapped[str] = mapped_column(String(255), primary_key=True)
    data: Mapped[bytes] = mapped_column(LargeBinary)
