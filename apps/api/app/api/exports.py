from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.api.dependencies import CurrentUser, DbSession
from app.schemas.api import ExportRequest
from app.services.exports import create_export

router = APIRouter(prefix="/exports", tags=["exports"])


@router.post("")
def export_analysis(payload: ExportRequest, db: DbSession, user: CurrentUser):
    buffer = create_export(db, payload, user)
    filename = f"brugali_costos_{payload.price_list_code}_{payload.query_date.isoformat()}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

