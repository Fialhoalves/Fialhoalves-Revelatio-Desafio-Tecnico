from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    original_name: str
    content_type: str
    size: int
    created_at: datetime
