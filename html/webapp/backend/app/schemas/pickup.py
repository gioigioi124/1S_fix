from typing import List, Optional
from pydantic import BaseModel

class PickupItemSchema(BaseModel):
    stt0: str
    stt: Optional[str] = ""
    ma_vt: str
    ten_vt: Optional[str] = ""
    dvt: Optional[str] = ""
    dvt_ban: Optional[str] = ""
    ma_kho: Optional[str] = ""
    so_tam: Optional[float] = 0.0
    he_so8: Optional[float] = 1.0
    so_luong8: Optional[float] = 0.0
    so_luong9: Optional[float] = 0.0
    loai_vt: Optional[str] = "1"

class PickupSlipSchema(BaseModel):
    stt: str
    so_ct: Optional[str] = ""
    ngay_ct: str
    ma_dt: str
    ten_dt: Optional[str] = ""
    dia_chi: Optional[str] = ""
    ma_xe: Optional[str] = ""
    total_items: int = 0
    total_so_tam: float = 0.0
    total_so_luong9: float = 0.0

class PickupDetailResponse(BaseModel):
    stt: str
    items: List[PickupItemSchema]

class PickupAcceptRequest(BaseModel):
    """Danh sách Stt phiếu xuất kho người dùng đã chọn (nút Chấp nhận - ctbhch)."""
    stts: List[str]

class PickupAcceptRow(BaseModel):
    """Dòng dữ liệu ánh xạ sang K_CtTemp (dòng chi tiết chứng từ) — chỉ trả về, KHÔNG ghi."""
    stt_px: str
    stt0_px: str
    ma_vt: str
    ten_vt: Optional[str] = ""
    dvt: Optional[str] = ""
    dvt_ban: Optional[str] = ""
    ma_kho: Optional[str] = ""
    so_tam: float = 0.0
    he_so8: float = 1.0
    so_luong8: float = 0.0
    so_luong9: float = 0.0
    loai_vt: Optional[str] = "1"

class PickupAcceptResponse(BaseModel):
    rows: List[PickupAcceptRow]
    total_rows: int = 0
