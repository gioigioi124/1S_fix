from typing import List, Optional
from app.repositories.pickup_repo import pickup_repository
from app.schemas.pickup import PickupSlipSchema, PickupDetailResponse

class PickupService:
    def __init__(self):
        self.repo = pickup_repository

    def list_ready_to_pickup(
        self,
        ma_dt: Optional[str] = None,
        ngay_ct1: Optional[str] = None,
        ngay_ct2: Optional[str] = None
    ) -> List[PickupSlipSchema]:
        return self.repo.list_ready_to_pickup(ma_dt=ma_dt, ngay_ct1=ngay_ct1, ngay_ct2=ngay_ct2)

    def get_pickup_detail(self, stt: str) -> Optional[PickupDetailResponse]:
        return self.repo.get_pickup_detail(stt=stt)

pickup_service = PickupService()
