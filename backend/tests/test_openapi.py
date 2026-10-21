from app.main import app


def test_upload_field_is_documented_as_binary_file_input():
    """O Swagger só mostra o seletor de arquivo quando o item da lista é `format: binary`."""
    schema = app.openapi()
    body = schema["components"]["schemas"]["Body_upload_attachments_tasks__task_id__attachments_post"]
    assert body["properties"]["files"]["items"]["format"] == "binary"


def test_every_operation_has_a_summary_and_a_tag():
    for path, operations in app.openapi()["paths"].items():
        for method, operation in operations.items():
            assert operation.get("summary"), f"{method.upper()} {path} falta o campo summary"
            assert operation.get("tags"), f"{method.upper()} {path} falta a tag"
