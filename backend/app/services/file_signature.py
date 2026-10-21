"""Confere se o início do arquivo condiz com o tipo declarado no upload."""

_OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_ZIP = b"PK\x03\x04"

_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/gif": (b"GIF87a", b"GIF89a"),
    "application/pdf": (b"%PDF-",),
    "application/msword": (_OLE,),
    "application/vnd.ms-excel": (_OLE,),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (_ZIP,),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (_ZIP,),
}

_TEXT_TYPES = {"text/plain", "text/csv"}
_BINARY_PREFIXES = tuple(sig for sigs in _SIGNATURES.values() for sig in sigs) + (b"MZ", b"\x7fELF", b"RIFF")


def matches_declared_type(content_type: str, head: bytes) -> bool:
    if content_type == "image/webp":
        return head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    if content_type in _TEXT_TYPES:
        # Texto não tem assinatura: rejeita bytes nulos e cabeçalhos de formatos binários.
        return b"\x00" not in head and not head.startswith(_BINARY_PREFIXES)
    signatures = _SIGNATURES.get(content_type, ())
    return any(head.startswith(sig) for sig in signatures)
