import json
import re
import uuid
from hashlib import sha256
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.dependencies import DbSession, require_roles
from app.core.config import get_settings
from app.db.base import Role, User
from app.schemas.api import CommitResponse, PreviewResponse
from app.services.importer import parse_workbook
from app.services.persistence import commit_workbook

router = APIRouter(prefix="/imports", tags=["imports"])
AdminUser = Depends(require_roles(Role.ADMIN_IMPORTER))


def safe_filename(filename: str | None) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._ -]", "_", filename or "import.xlsx").strip()
    return cleaned[:180] or "import.xlsx"


@router.post("/preview", response_model=PreviewResponse)
async def preview_import(
    file: UploadFile = File(...),
    user: User = AdminUser,
) -> PreviewResponse:
    settings = get_settings()
    filename = safe_filename(file.filename)
    if Path(filename).suffix.lower() != ".xlsx":
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only .xlsx files are accepted")
    content = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File exceeds configured size")
    if not content.startswith(b"PK"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The file is not a valid Excel package")

    preview_id = str(uuid.uuid4())
    preview_dir = settings.data_dir / "previews"
    preview_dir.mkdir(parents=True, exist_ok=True)
    path = preview_dir / f"{preview_id}.xlsx"
    path.write_bytes(content)
    try:
        parsed = parse_workbook(path)
    except Exception as exc:
        path.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    metadata = {"filename": filename, "sha256": sha256(content).hexdigest(), "user_id": user.id}
    (preview_dir / f"{preview_id}.json").write_text(json.dumps(metadata), encoding="utf-8")
    return PreviewResponse(
        preview_id=preview_id,
        filename=filename,
        sha256=parsed.sha256,
        summary=parsed.summary,
        issues=[issue.as_dict() for issue in parsed.issues[:200]],
    )


@router.post("/{preview_id}/commit", response_model=CommitResponse)
def commit_import(
    preview_id: str,
    db: DbSession,
    user: User = AdminUser,
) -> CommitResponse:
    settings = get_settings()
    preview_dir = settings.data_dir / "previews"
    path = preview_dir / f"{preview_id}.xlsx"
    metadata_path = preview_dir / f"{preview_id}.json"
    if not path.exists() or not metadata_path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Preview not found or expired")
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    batch = commit_workbook(db, path, metadata["filename"], user.id)
    path.unlink(missing_ok=True)
    metadata_path.unlink(missing_ok=True)
    return CommitResponse(batch_id=batch.id, summary=batch.summary)

