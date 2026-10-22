from typing import List, Optional
from app.repositories.pickup_repo import pickup_repository
from app.schemas.pickup import (
    PickupSlipSchema, PickupDetailResponse,
    PickupAcceptRow, PickupAcceptResponse,
)

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

    def accept_pickup(self, stts: List[str]) -> PickupAcceptResponse:
        """
        Gom các dòng hàng của những phiếu xuất kho đã chọn thành các dòng
        ánh xạ sang K_CtTemp (chi tiết chứng từ bán hàng). 100% READ-ONLY:
        chỉ ĐỌC và TRẢ VỀ dữ liệu, KHÔNG ghi vào CSDL.
        """
        rows: List[PickupAcceptRow] = []
        for stt in stts:
            if not stt:
                continue
            detail = self.repo.get_pickup_detail(stt=stt)
            if not detail:
                continue
            for it in detail.items:
                rows.append(PickupAcceptRow(
                    stt_px=stt,
                    stt0_px=it.stt0,
                    ma_vt=it.ma_vt,
                    ten_vt=it.ten_vt,
                    dvt=it.dvt,
                    dvt_ban=it.dvt_ban,
                    ma_kho=it.ma_kho,
                    so_tam=it.so_tam or 0.0,
                    he_so8=it.he_so8 or 1.0,
                    so_luong8=it.so_luong8 or 0.0,
                    so_luong9=it.so_luong9 or 0.0,
                    loai_vt=it.loai_vt or "1",
                ))
        return PickupAcceptResponse(rows=rows, total_rows=len(rows))

pickup_service = PickupService()
