"""armazenamento de anexos no banco

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-21 15:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('attachment_blobs',
    sa.Column('stored_name', sa.String(length=255), nullable=False),
    sa.Column('data', sa.LargeBinary(), nullable=False),
    sa.PrimaryKeyConstraint('stored_name')
    )


def downgrade() -> None:
    op.drop_table('attachment_blobs')
