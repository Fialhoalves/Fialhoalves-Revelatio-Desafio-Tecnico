"""Dados de demonstração: usuários, tarefas e anexos para exercitar todos os fluxos da aplicação.

Ativado por SEED_DEMO_DATA=true. É idempotente: não duplica tarefas já existentes (mesmo dono e título).
Os anexos são gerados em memória e passam pelo mesmo serviço do upload, incluindo a validação de assinatura.
"""

import io
import struct
import zlib
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.datastructures import Headers, UploadFile

from app.core.config import get_settings
from app.core.security import hash_password
from app.models import Priority, Role, Task, TaskStatus, User
from app.services.attachments import add_attachment
from app.storage import Storage

# --- Geração dos arquivos de exemplo ---------------------------------------------------


def _png(width: int, height: int, paint: Callable[..., None], background: tuple[int, int, int]) -> bytes:
    pixels = bytearray(bytes(background) * (width * height))

    def rect(x: int, y: int, w: int, h: int, color: tuple[int, int, int]) -> None:
        for row in range(max(y, 0), min(y + h, height)):
            start = (row * width + max(x, 0)) * 3
            end = (row * width + min(x + w, width)) * 3
            pixels[start:end] = bytes(color) * ((end - start) // 3)

    paint(pixels, rect)

    raw = b"".join(b"\x00" + bytes(pixels[row * width * 3 : (row + 1) * width * 3]) for row in range(height))

    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def wireframe_png() -> bytes:
    def paint(_pixels, rect):
        rect(0, 0, 480, 36, (60, 64, 84))
        rect(16, 52, 140, 110, (88, 96, 140))
        rect(170, 52, 140, 110, (88, 96, 140))
        rect(324, 52, 140, 110, (88, 96, 140))
        rect(16, 178, 448, 80, (52, 56, 76))
        rect(16, 270, 200, 10, (110, 116, 150))

    return _png(480, 300, paint, (28, 30, 42))


def chart_png() -> bytes:
    def paint(_pixels, rect):
        for index, height in enumerate((60, 110, 85, 150, 130, 175)):
            rect(30 + index * 70, 200 - height, 46, height, (64, 170, 140))
        rect(20, 200, 430, 3, (200, 200, 210))

    return _png(480, 220, paint, (20, 32, 38))


def gradient_png() -> bytes:
    def paint(pixels, _rect):
        width, height = 480, 270
        for y in range(height):
            for x in range(width):
                offset = (y * width + x) * 3
                pixels[offset : offset + 3] = bytes((40 + x * 120 // width, 60 + y * 100 // height, 150 - x * 60 // width))

    return _png(480, 270, paint, (0, 0, 0))


def _pdf(title: str, lines: list[str]) -> bytes:
    def escape(text: str) -> str:
        return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    parts = [f"BT /F1 20 Tf 72 740 Td ({escape(title)}) Tj ET"]
    parts += [f"BT /F1 12 Tf 72 {700 - index * 22} Td ({escape(line)}) Tj ET" for index, line in enumerate(lines)]
    stream = "\n".join(parts)
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(stream.encode('latin-1'))} >>\nstream\n{stream}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n{body}\nendobj\n".encode("latin-1")
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def _text(content: str) -> bytes:
    return content.encode("utf-8")


@dataclass(frozen=True)
class Asset:
    name: str
    content_type: str
    build: Callable[[], bytes]


ASSETS: dict[str, Asset] = {
    asset.name: asset
    for asset in (
        Asset("wireframe-relatorios.png", "image/png", wireframe_png),
        Asset("grafico-vendas.png", "image/png", chart_png),
        Asset("capa-apresentacao.png", "image/png", gradient_png),
        Asset(
            "roteiro-apresentacao.pdf",
            "application/pdf",
            lambda: _pdf(
                "Roteiro da apresentação",
                ["1. Contexto e objetivos da sprint", "2. Entregas concluídas", "3. Pendências e riscos", "4. Próximos passos"],
            ),
        ),
        Asset(
            "contrato-fornecedor.pdf",
            "application/pdf",
            lambda: _pdf(
                "Contrato de fornecimento",
                ["Cláusula 1: objeto e prazo", "Cláusula 2: valores e reajuste", "Cláusula 3: rescisão", "Pendente de revisão jurídica"],
            ),
        ),
        Asset(
            "validacao-ambiente.csv",
            "text/csv",
            lambda: _text("item,responsavel,status\nBanco de dados,Ana,ok\nVariáveis de ambiente,Bruno,ok\nDeploy,Ana,ok\n"),
        ),
        Asset(
            "notas-api.txt",
            "text/plain",
            lambda: _text("Rotas revisadas:\n- /tasks\n- /attachments\nPendente: exemplos de erro por código.\n"),
        ),
    )
}

# --- Usuários e tarefas -----------------------------------------------------------------


@dataclass(frozen=True)
class DemoTask:
    title: str
    description: str
    status: TaskStatus
    priority: Priority
    due_in_days: int | None
    assets: tuple[str, ...] = ()


P, I, D = TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.DONE
LOW, MED, HIGH = Priority.LOW, Priority.MEDIUM, Priority.HIGH

# Usuário comum de demonstração (criado pelo seed principal), com um exemplo de cada situação.
DEMO_USER_TASKS = (
    DemoTask("Preparar apresentação da sprint", "Reunir resultados e montar os slides da review de quinta.", P, HIGH, 3,
             ("roteiro-apresentacao.pdf", "capa-apresentacao.png")),
    DemoTask("Revisar contrato do fornecedor", "Conferir cláusulas de reajuste e rescisão antes da assinatura.", P, MED, -2,
             ("contrato-fornecedor.pdf",)),
    DemoTask("Comprar material de escritório", "Canetas, post-its e um quadro branco pequeno.", P, LOW, None),
    DemoTask("Redesenhar tela de relatórios", "Nova disposição dos filtros e dos gráficos de vendas.", I, HIGH, 5,
             ("wireframe-relatorios.png", "grafico-vendas.png")),
    DemoTask("Escrever documentação da API", "Descrever rotas, exemplos e códigos de erro.", I, MED, 7, ("notas-api.txt",)),
    DemoTask("Corrigir bug no checkout", "O cupom de desconto não é aplicado quando o carrinho tem frete grátis.", I, HIGH, -1),
    DemoTask("Configurar ambiente de homologação", "Banco, variáveis de ambiente e deploy automático.", D, MED, -4,
             ("validacao-ambiente.csv",)),
    DemoTask("Enviar relatório mensal", "Consolidar indicadores e enviar para a diretoria.", D, LOW, -10),
)

ADMIN_TASKS = (
    DemoTask("Revisar permissões dos usuários", "Conferir quem tem acesso de administrador.", I, HIGH, 2),
    DemoTask("Planejar a próxima release", "Definir escopo e datas com o time.", P, MED, 14, ("capa-apresentacao.png",)),
)

# Usuários adicionais, para o administrador ver o resumo por usuário.
EXTRA_USERS: dict[str, tuple[str, tuple[DemoTask, ...]]] = {
    "ana@example.com": (
        "Ana Souza",
        (
            DemoTask("Entrevistar candidatos de design", "Três entrevistas de 45 minutos.", P, MED, 4),
            DemoTask("Atualizar guia de estilo", "Incluir os novos componentes de formulário.", I, MED, 6,
                     ("wireframe-relatorios.png",)),
            DemoTask("Fechar orçamento do trimestre", "Planilha com custos por área.", D, HIGH, -3, ("validacao-ambiente.csv",)),
            DemoTask("Organizar workshop interno", "Reservar sala e enviar convites.", P, LOW, 20),
        ),
    ),
    "bruno@example.com": (
        "Bruno Lima",
        (
            DemoTask("Migrar serviço de e-mails", "Trocar o provedor e validar os envios.", I, HIGH, -1),
            DemoTask("Revisar pull requests abertos", "Priorizar os que bloqueiam a release.", P, MED, 1, ("notas-api.txt",)),
            DemoTask("Renovar certificados", "Domínios principais e de homologação.", D, MED, -7),
        ),
    ),
}


def _get_or_create_user(db: Session, email: str, name: str, role: Role = Role.USER) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(name=name, email=email, password_hash=hash_password(get_settings().demo_user_password), role=role)
        db.add(user)
        db.commit()
    return user


def _upload(asset: Asset) -> UploadFile:
    data = asset.build()
    return UploadFile(
        file=io.BytesIO(data), size=len(data), filename=asset.name, headers=Headers({"content-type": asset.content_type})
    )


def _populate_user(db: Session, storage: Storage, owner: User, tasks: tuple[DemoTask, ...]) -> tuple[int, int]:
    created_tasks = created_files = 0
    existing = set(db.scalars(select(Task.title).where(Task.owner_id == owner.id)))
    for item in tasks:
        if item.title in existing:
            continue
        task = Task(
            title=item.title,
            description=item.description,
            status=item.status,
            priority=item.priority,
            due_date=date.today() + timedelta(days=item.due_in_days) if item.due_in_days is not None else None,
            owner_id=owner.id,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        created_tasks += 1
        for name in item.assets:
            add_attachment(db, storage, task, _upload(ASSETS[name]))
            created_files += 1
    return created_tasks, created_files


def populate(db: Session, storage: Storage) -> dict[str, int]:
    """Cria usuários, tarefas e anexos de demonstração. Retorna quantos itens novos foram criados."""
    settings = get_settings()
    totals = {"users": 0, "tasks": 0, "attachments": 0}

    people = [
        (_get_or_create_user(db, settings.demo_user_email, "Usuário Demo"), DEMO_USER_TASKS),
        (_get_or_create_user(db, settings.admin_email, settings.admin_name, Role.ADMIN), ADMIN_TASKS),
    ]
    for email, (name, tasks) in EXTRA_USERS.items():
        known = db.scalar(select(User.id).where(User.email == email)) is not None
        people.append((_get_or_create_user(db, email, name), tasks))
        totals["users"] += 0 if known else 1

    for owner, tasks in people:
        created_tasks, created_files = _populate_user(db, storage, owner, tasks)
        totals["tasks"] += created_tasks
        totals["attachments"] += created_files
    return totals
