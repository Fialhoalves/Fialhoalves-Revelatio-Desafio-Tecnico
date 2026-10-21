"""Dados de demonstração: usuários, tarefas e anexos para exercitar todos os fluxos da aplicação.

Ativado por SEED_DEMO_DATA=true. É idempotente: não duplica tarefas já existentes (mesmo dono e título).
Os anexos são gerados em memória e passam pelo mesmo serviço do upload, incluindo a validação de assinatura.
"""

import io
import struct
import zipfile
import zlib
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, timedelta
from xml.sax.saxutils import escape

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


def _zip(parts: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in parts.items():
            archive.writestr(name, content)
    return buffer.getvalue()


_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_RELS_PKG = "http://schemas.openxmlformats.org/package/2006/relationships"


def _docx(title: str, paragraphs: list[str]) -> bytes:
    """Documento Word mínimo e válido, com um parágrafo por linha."""
    body = "".join(
        f'<w:p><w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>' for text in [title, *paragraphs]
    )
    return _zip(
        {
            "[Content_Types].xml": _XML
            + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>",
            "_rels/.rels": _XML
            + f'<Relationships xmlns="{_RELS_PKG}"><Relationship Id="rId1" '
            f'Type="{_REL}/officeDocument" Target="word/document.xml"/></Relationships>',
            "word/document.xml": _XML
            + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            f"<w:body>{body}</w:body></w:document>",
        }
    )


def _xlsx(rows: list[list[str | int]]) -> bytes:
    """Planilha Excel mínima e válida, com texto e números na primeira aba."""

    def cell(row: int, column: int, value: str | int) -> str:
        reference = f"{chr(ord('A') + column)}{row}"
        if isinstance(value, int):
            return f'<c r="{reference}"><v>{value}</v></c>'
        return f'<c r="{reference}" t="inlineStr"><is><t>{escape(value)}</t></is></c>'

    sheet = "".join(
        f'<row r="{number}">{"".join(cell(number, column, value) for column, value in enumerate(row))}</row>'
        for number, row in enumerate(rows, start=1)
    )
    return _zip(
        {
            "[Content_Types].xml": _XML
            + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            "</Types>",
            "_rels/.rels": _XML
            + f'<Relationships xmlns="{_RELS_PKG}"><Relationship Id="rId1" '
            f'Type="{_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>',
            "xl/workbook.xml": _XML
            + f'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="{_REL}">'
            '<sheets><sheet name="Plan1" sheetId="1" r:id="rId1"/></sheets></workbook>',
            "xl/_rels/workbook.xml.rels": _XML
            + f'<Relationships xmlns="{_RELS_PKG}"><Relationship Id="rId1" '
            f'Type="{_REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
            "xl/worksheets/sheet1.xml": _XML
            + f'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>{sheet}</sheetData></worksheet>',
        }
    )


def error_png() -> bytes:
    def paint(_pixels, rect):
        rect(0, 0, 480, 40, (150, 40, 50))
        rect(120, 70, 240, 130, (44, 36, 40))
        rect(120, 70, 240, 22, (200, 70, 80))
        rect(140, 110, 200, 10, (150, 120, 126))
        rect(140, 132, 150, 10, (110, 90, 96))
        rect(140, 168, 70, 20, (200, 70, 80))

    return _png(480, 240, paint, (24, 20, 24))


def infra_png() -> bytes:
    def paint(_pixels, rect):
        for x in (30, 190, 350):
            rect(x, 90, 100, 60, (70, 120, 170))
        rect(130, 116, 60, 6, (190, 200, 215))
        rect(290, 116, 60, 6, (190, 200, 215))
        rect(190, 200, 100, 40, (60, 150, 120))
        rect(236, 150, 6, 50, (190, 200, 215))

    return _png(480, 270, paint, (22, 28, 38))


def palette_png() -> bytes:
    def paint(_pixels, rect):
        colors = ((236, 112, 99), (245, 176, 65), (88, 214, 141), (93, 173, 226), (175, 122, 197))
        for index, color in enumerate(colors):
            rect(20 + index * 90, 40, 70, 70, color)
            rect(20 + index * 90, 124, 70, 10, (200, 200, 205))

    return _png(480, 170, paint, (30, 30, 34))


@dataclass(frozen=True)
class Asset:
    name: str
    content_type: str
    build: Callable[[], bytes]


_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

ASSETS: dict[str, Asset] = {
    asset.name: asset
    for asset in (
        Asset("wireframe-relatorios.png", "image/png", wireframe_png),
        Asset("grafico-vendas.png", "image/png", chart_png),
        Asset("capa-apresentacao.png", "image/png", gradient_png),
        Asset("erro-checkout.png", "image/png", error_png),
        Asset("diagrama-infra.png", "image/png", infra_png),
        Asset("guia-estilo.png", "image/png", palette_png),
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
            "roteiro-entrevista.pdf",
            "application/pdf",
            lambda: _pdf(
                "Roteiro de entrevista",
                ["Portfólio e processo de design", "Trabalho em equipe", "Ferramentas e métodos", "Perguntas do candidato"],
            ),
        ),
        Asset(
            "validacao-ambiente.csv",
            "text/csv",
            lambda: _text("item,responsavel,status\nBanco de dados,Ana,ok\nVariáveis de ambiente,Bruno,ok\nDeploy,Ana,ok\n"),
        ),
        Asset(
            "lista-compras.csv",
            "text/csv",
            lambda: _text("item,quantidade,prioridade\nCanetas,20,baixa\nPost-its,10,baixa\nQuadro branco,1,media\n"),
        ),
        Asset(
            "certificados.csv",
            "text/csv",
            lambda: _text("dominio,vencimento,status\napp.exemplo.com,2026-11-30,renovado\nhomolog.exemplo.com,2026-12-15,renovado\n"),
        ),
        Asset(
            "matriz-permissoes.csv",
            "text/csv",
            lambda: _text("perfil,criar,ver proprias,ver todas,editar todas\nUsuario,sim,sim,nao,nao\nAdministrador,sim,sim,sim,sim\n"),
        ),
        Asset(
            "notas-api.txt",
            "text/plain",
            lambda: _text("Rotas revisadas:\n- /tasks\n- /attachments\nPendente: exemplos de erro por código.\n"),
        ),
        Asset(
            "notas-reuniao.txt",
            "text/plain",
            lambda: _text("Reunião de alinhamento\nDecisões: manter o escopo da sprint; revisar prazos na quinta.\nResponsáveis: Ana (design), Bruno (infra).\n"),
        ),
        Asset(
            "log-erro.txt",
            "text/plain",
            lambda: _text("2026-10-20 14:02:11 ERROR checkout: cupom FRETE10 ignorado (frete grátis ativo)\n2026-10-20 14:02:11 WARN  pricing: total recalculado sem desconto\n"),
        ),
        Asset(
            "especificacao-api.docx",
            _DOCX,
            lambda: _docx(
                "Especificação da API",
                ["Autenticação: JWT no cabeçalho Authorization.", "Erros: formato único com código e mensagem.", "Anexos: até 10 MB por arquivo."],
            ),
        ),
        Asset(
            "relatorio-mensal.docx",
            _DOCX,
            lambda: _docx("Relatório mensal", ["Indicadores consolidados do mês.", "Tarefas concluídas: 42.", "Principais riscos: prazo de homologação."]),
        ),
        Asset(
            "orcamento-trimestre.xlsx",
            _XLSX,
            lambda: _xlsx([["Área", "Previsto", "Realizado"], ["Design", 12000, 11200], ["Engenharia", 48000, 50100], ["Marketing", 9000, 8700]]),
        ),
        Asset(
            "cronograma-release.xlsx",
            _XLSX,
            lambda: _xlsx([["Etapa", "Início", "Fim"], ["Congelamento", "03/11", "05/11"], ["Homologação", "06/11", "12/11"], ["Publicação", "13/11", "13/11"]]),
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

# Usuário comum de demonstração (criado pelo seed principal). Todas as tarefas têm anexos de tipos variados;
# "Redesenhar tela de relatórios" tem quatro, para exercitar o indicador "+N" do cartão.
DEMO_USER_TASKS = (
    DemoTask("Preparar apresentação da sprint", "Reunir resultados e montar os slides da review de quinta.", P, HIGH, 3,
             ("roteiro-apresentacao.pdf", "capa-apresentacao.png", "notas-reuniao.txt")),
    DemoTask("Revisar contrato do fornecedor", "Conferir cláusulas de reajuste e rescisão antes da assinatura.", P, MED, -2,
             ("contrato-fornecedor.pdf", "orcamento-trimestre.xlsx")),
    DemoTask("Comprar material de escritório", "Canetas, post-its e um quadro branco pequeno.", P, LOW, None,
             ("lista-compras.csv",)),
    DemoTask("Redesenhar tela de relatórios", "Nova disposição dos filtros e dos gráficos de vendas.", I, HIGH, 5,
             ("wireframe-relatorios.png", "grafico-vendas.png", "guia-estilo.png", "notas-reuniao.txt")),
    DemoTask("Escrever documentação da API", "Descrever rotas, exemplos e códigos de erro.", I, MED, 7,
             ("notas-api.txt", "especificacao-api.docx")),
    DemoTask("Corrigir bug no checkout", "O cupom de desconto não é aplicado quando o carrinho tem frete grátis.", I, HIGH, -1,
             ("erro-checkout.png", "log-erro.txt")),
    DemoTask("Configurar ambiente de homologação", "Banco, variáveis de ambiente e deploy automático.", D, MED, -4,
             ("validacao-ambiente.csv", "diagrama-infra.png")),
    DemoTask("Enviar relatório mensal", "Consolidar indicadores e enviar para a diretoria.", D, LOW, -10,
             ("relatorio-mensal.docx",)),
)

ADMIN_TASKS = (
    DemoTask("Revisar permissões dos usuários", "Conferir quem tem acesso de administrador.", I, HIGH, 2,
             ("matriz-permissoes.csv", "notas-reuniao.txt")),
    DemoTask("Planejar a próxima release", "Definir escopo e datas com o time.", P, MED, 14,
             ("capa-apresentacao.png", "cronograma-release.xlsx")),
)

# Usuários adicionais, para o administrador ver o resumo por usuário. Uma tarefa sem anexo cobre esse caso.
EXTRA_USERS: dict[str, tuple[str, tuple[DemoTask, ...]]] = {
    "ana@example.com": (
        "Ana Souza",
        (
            DemoTask("Entrevistar candidatos de design", "Três entrevistas de 45 minutos.", P, MED, 4,
                     ("roteiro-entrevista.pdf",)),
            DemoTask("Atualizar guia de estilo", "Incluir os novos componentes de formulário.", I, MED, 6,
                     ("guia-estilo.png", "wireframe-relatorios.png")),
            DemoTask("Fechar orçamento do trimestre", "Planilha com custos por área.", D, HIGH, -3,
                     ("orcamento-trimestre.xlsx", "validacao-ambiente.csv")),
            DemoTask("Organizar workshop interno", "Reservar sala e enviar convites.", P, LOW, 20),
        ),
    ),
    "bruno@example.com": (
        "Bruno Lima",
        (
            DemoTask("Migrar serviço de e-mails", "Trocar o provedor e validar os envios.", I, HIGH, -1,
                     ("diagrama-infra.png", "log-erro.txt")),
            DemoTask("Revisar pull requests abertos", "Priorizar os que bloqueiam a release.", P, MED, 1,
                     ("notas-api.txt", "especificacao-api.docx")),
            DemoTask("Renovar certificados", "Domínios principais e de homologação.", D, MED, -7, ("certificados.csv",)),
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
    """Cria as tarefas que faltam e completa os anexos de exemplo, inclusive em tarefas já existentes."""
    created_tasks = created_files = 0
    existing = {task.title: task for task in db.scalars(select(Task).where(Task.owner_id == owner.id))}
    for item in tasks:
        task = existing.get(item.title)
        if task is None:
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
        present = {attachment.original_name for attachment in task.attachments}
        for name in item.assets:
            if name not in present:
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
