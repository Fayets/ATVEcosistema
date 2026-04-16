"""Plantillas de entregables (Pony + JSON). Ver docs/convenciones-backend-pony.md."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from pony.orm import db_session

from src.models import EntregablePlantilla
from src.schemas import (
    EntregableCampoSchema,
    EntregablePlantillaCreate,
    EntregablePlantillaListItem,
    EntregablePlantillaMetaPatch,
    EntregablePlantillaResponse,
    EntregablePlantillaUpdate,
)

_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{0,79}$")  # máx. 80 caracteres en total

SLUG_ONBOARDING = "onboarding"
NOMBRE_ONBOARDING = "Onboarding"

# Un campo inicial válido para plantillas nuevas (editable luego).
_CAMPO_PLANTILLA_INICIAL: dict[str, Any] = {
    "key": "ejemplo",
    "label": "Ejemplo",
    "question": "Reemplazá este bloque con tu primera pregunta.",
    "example": "Texto de ejemplo para el cliente.",
    "long": True,
    "optional": True,
}


class EntregablesServices:
    """Lectura/escritura de `EntregablePlantilla` (una fila por `slug`)."""

    @staticmethod
    def _default_campos_path() -> Path:
        return Path(__file__).resolve().parent.parent / "data" / "onboarding_plantilla_default.json"

    @staticmethod
    def _load_default_campos() -> list[dict[str, Any]]:
        p = EntregablesServices._default_campos_path()
        with open(p, encoding="utf-8") as f:
            raw = json.load(f)
        if not isinstance(raw, list):
            raise RuntimeError("onboarding_plantilla_default.json debe ser un array.")
        return [dict(x) for x in raw]

    @staticmethod
    def _campos_desde_configuracion(config: Any) -> Any:
        if not isinstance(config, dict):
            raise HTTPException(status_code=500, detail="configuracion debe ser un objeto JSON.")
        if "campos" not in config:
            raise HTTPException(status_code=500, detail='Falta la clave "campos" en configuracion.')
        return config["campos"]

    @staticmethod
    def _normalize_campos_list(raw: Any) -> list[dict[str, Any]]:
        if not isinstance(raw, list) or len(raw) == 0:
            raise HTTPException(
                status_code=500,
                detail="La plantilla en base de datos está corrupta o vacía.",
            )
        out: list[dict[str, Any]] = []
        for i, item in enumerate(raw):
            if not isinstance(item, dict):
                raise HTTPException(status_code=500, detail=f"Campo #{i + 1} inválido en plantilla.")
            out.append(dict(item))
        return out

    @staticmethod
    def _validate_campos_structure(campos: list[dict[str, Any]]) -> None:
        if len(campos) == 0:
            raise HTTPException(status_code=400, detail="La plantilla debe tener al menos un campo.")
        keys: list[str] = []
        for i, c in enumerate(campos):
            key = str(c.get("key", "")).strip()
            if not _KEY_RE.match(key):
                raise HTTPException(
                    status_code=400,
                    detail=f"Clave inválida en posición {i + 1}: debe ser snake_case (letra minúscula inicial).",
                )
            keys.append(key)
        if len(set(keys)) != len(keys):
            raise HTTPException(status_code=400, detail="Hay claves duplicadas en la plantilla.")

    @staticmethod
    def _ensure_onboarding_default_row() -> None:
        """Si no existe onboarding, crea la fila con el JSON por defecto (formulario público)."""
        if EntregablePlantilla.get(slug=SLUG_ONBOARDING) is not None:
            return
        default = EntregablesServices._load_default_campos()
        EntregablePlantilla(
            slug=SLUG_ONBOARDING,
            nombre=NOMBRE_ONBOARDING,
            configuracion={"campos": default},
        )

    @staticmethod
    def list_plantillas() -> list[EntregablePlantillaListItem]:
        with db_session:
            EntregablesServices._ensure_onboarding_default_row()
            rows = EntregablePlantilla.select().order_by(EntregablePlantilla.slug)._actual_fetch()
            return [
                EntregablePlantillaListItem(slug=r.slug, nombre=r.nombre, updated_at=r.updated_at)
                for r in rows
            ]

    @staticmethod
    def create_plantilla(body: EntregablePlantillaCreate) -> EntregablePlantillaResponse:
        slug = body.slug
        if slug == SLUG_ONBOARDING:
            raise HTTPException(
                status_code=400,
                detail="El entregable «onboarding» ya está reservado; se crea solo por defecto.",
            )
        campos_iniciales = [dict(_CAMPO_PLANTILLA_INICIAL)]
        EntregableCampoSchema.model_validate(campos_iniciales[0])
        nombre = body.nombre if body.nombre else slug.replace("_", " ").title()
        with db_session:
            if EntregablePlantilla.get(slug=slug) is not None:
                raise HTTPException(status_code=409, detail="Ya existe una plantilla con ese slug.")
            EntregablePlantilla(
                slug=slug,
                nombre=nombre,
                configuracion={"campos": campos_iniciales},
            )
        return EntregablesServices.get_plantilla_response(slug)

    @staticmethod
    def patch_plantilla_meta(slug: str, body: EntregablePlantillaMetaPatch) -> EntregablePlantillaResponse:
        patch = body.model_dump(exclude_unset=True)
        with db_session:
            row = EntregablePlantilla.get(slug=slug)
            if row is None:
                raise HTTPException(status_code=404, detail="Plantilla no encontrada.")
            if "nombre" in patch:
                row.nombre = patch["nombre"]
        return EntregablesServices.get_plantilla_response(slug)

    @staticmethod
    def get_plantilla_response(slug: str) -> EntregablePlantillaResponse:
        with db_session:
            row = EntregablePlantilla.get(slug=slug)
            if row is None:
                if slug == SLUG_ONBOARDING:
                    EntregablesServices._ensure_onboarding_default_row()
                    row = EntregablePlantilla.get(slug=slug)
                else:
                    raise HTTPException(status_code=404, detail="Plantilla no encontrada.")
            raw_campos = EntregablesServices._campos_desde_configuracion(row.configuracion)
            campos = EntregablesServices._normalize_campos_list(raw_campos)
            fields = [EntregableCampoSchema.model_validate(x) for x in campos]
            return EntregablePlantillaResponse(
                slug=row.slug,
                nombre=row.nombre,
                campos=fields,
                updated_at=row.updated_at,
            )

    @staticmethod
    def replace_plantilla(slug: str, body: EntregablePlantillaUpdate) -> EntregablePlantillaResponse:
        campos_raw = [c.model_dump() for c in body.campos]
        EntregablesServices._validate_campos_structure(campos_raw)
        nueva = {"campos": campos_raw}
        with db_session:
            row = EntregablePlantilla.get(slug=slug)
            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Plantilla no encontrada. Creala primero desde «Nuevo entregable».",
                )
            row.configuracion = nueva
        return EntregablesServices.get_plantilla_response(slug)

    @staticmethod
    def validate_submitted_respuestas(respuestas: dict[str, str]) -> None:
        with db_session:
            EntregablesServices._ensure_onboarding_default_row()
            row = EntregablePlantilla.get(slug=SLUG_ONBOARDING)
            if row is None:
                raise HTTPException(status_code=500, detail="Plantilla de onboarding no disponible.")
            raw_campos = EntregablesServices._campos_desde_configuracion(row.configuracion)
            campos = EntregablesServices._normalize_campos_list(raw_campos)
        keys_def = {str(c["key"]) for c in campos}
        keys_sent = set(respuestas.keys())
        if keys_sent != keys_def:
            missing = sorted(keys_def - keys_sent)
            extra = sorted(keys_sent - keys_def)
            parts: list[str] = []
            if missing:
                parts.append(f"faltan: {missing}")
            if extra:
                parts.append(f"no permitidos: {extra}")
            raise HTTPException(
                status_code=400,
                detail="Las respuestas no coinciden con la plantilla actual (" + "; ".join(parts) + ").",
            )
        optional = {str(c["key"]) for c in campos if c.get("optional")}
        for k in keys_def:
            if k in optional:
                continue
            v = respuestas.get(k, "")
            if not str(v).strip():
                raise HTTPException(
                    status_code=400,
                    detail=f"El campo «{k}» no puede estar vacío.",
                )
