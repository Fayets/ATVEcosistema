from src.schemas import HealthResponse


class HealthServices:
    def ping(self) -> HealthResponse:
        return HealthResponse(status="ok")
