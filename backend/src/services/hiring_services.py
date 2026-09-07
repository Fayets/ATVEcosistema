from datetime import datetime, timezone

from fastapi import HTTPException
from pony.orm import db_session, desc

from src.db import db
from src.models import HiringApplication
from src.schemas import HIRING_STATUSES, HiringApplicationUpdate

HIRING_TABLE = '"hiring"."applications"'


class HiringServices:
    """Lectura y gestión de postulaciones. Los queries evitan lambdas/generadores
    de Pony (fallan en Python 3.13) y usan filtros por keyword + raw SQL para agregados."""

    def list(self, role_slug: str | None = None, status: str | None = None) -> list[dict]:
        with db_session:
            q = HiringApplication.select()
            if role_slug:
                q = q.filter(role_slug=role_slug.strip().lower())
            if status:
                q = q.filter(status=status)
            rows = q.order_by(desc(HiringApplication.created_at)).fetch()
            return [self._to_dict(rows[i]) for i in range(len(rows))]

    def metrics(self) -> dict:
        with db_session:
            total = HiringApplication.select().count()
            by_role = dict(db.select(f"SELECT role_slug, count(*) FROM {HIRING_TABLE} GROUP BY role_slug"))
            by_status = dict(db.select(f"SELECT status, count(*) FROM {HIRING_TABLE} GROUP BY status"))
            last_7d = db.select(
                f"SELECT count(*) FROM {HIRING_TABLE} WHERE created_at >= now() - interval '7 days'"
            )[0]
            return {"total": total, "last_7d": last_7d, "by_role": by_role, "by_status": by_status}

    def get(self, app_id: int) -> dict:
        with db_session:
            app = HiringApplication.get(id=app_id)
            if not app:
                raise HTTPException(status_code=404, detail="Postulación no encontrada.")
            return self._to_dict(app)

    def update(self, app_id: int, data: HiringApplicationUpdate, reviewed_by: str) -> dict:
        with db_session:
            app = HiringApplication.get(id=app_id)
            if not app:
                raise HTTPException(status_code=404, detail="Postulación no encontrada.")
            if data.status is not None:
                if data.status not in HIRING_STATUSES:
                    raise HTTPException(status_code=400, detail="Estado inválido.")
                app.status = data.status
            if data.notes is not None:
                app.notes = data.notes
            app.reviewed_by = reviewed_by
            app.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            return self._to_dict(app)

    def delete(self, app_id: int) -> dict:
        with db_session:
            app = HiringApplication.get(id=app_id)
            if not app:
                raise HTTPException(status_code=404, detail="Postulación no encontrada.")
            app.delete()
            return {"ok": True}

    @staticmethod
    def _to_dict(a: HiringApplication) -> dict:
        return {
            "id": a.id,
            "role_slug": a.role_slug,
            "role_label": a.role_label,
            "name": a.name,
            "email": a.email,
            "phone": a.phone,
            "country": a.country,
            "answers": a.answers or {},
            "source": a.source,
            "campaign": a.campaign,
            "page_url": a.page_url,
            "status": a.status,
            "notes": a.notes,
            "reviewed_by": a.reviewed_by,
            "created_at": a.created_at.isoformat(),
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        }
