from typing import Optional
from app.repositories.voucher_repo import voucher_repository
from app.schemas.voucher import VoucherListResponse, VoucherDetailResponse

class VoucherService:
    def __init__(self):
        self.repo = voucher_repository

    def list_vouchers(
        self,
        ma_ct: Optional[str] = "X1",
        ngay_ct1: Optional[str] = None,
        ngay_ct2: Optional[str] = None,
        so_ct1: Optional[str] = None,
        so_ct2: Optional[str] = None,
        ma_dt: Optional[str] = None,
        ma_kho: Optional[str] = None,
        ma_vt: Optional[str] = None,
        ma_tte: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> VoucherListResponse:
        return self.repo.list_vouchers(
            ma_ct=ma_ct,
            ngay_ct1=ngay_ct1,
            ngay_ct2=ngay_ct2,
            so_ct1=so_ct1,
            so_ct2=so_ct2,
            ma_dt=ma_dt,
            ma_kho=ma_kho,
            ma_vt=ma_vt,
            ma_tte=ma_tte,
            page=page,
            page_size=page_size
        )

    def get_voucher(self, stt: str) -> Optional[VoucherDetailResponse]:
        return self.repo.get_voucher_detail(stt)

voucher_service = VoucherService()
