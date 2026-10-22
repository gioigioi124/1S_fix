import logging
import math
from typing import Any, Dict, List, Optional, Tuple
from app.config import settings
from app.database import get_db_cursor
from app.utils.unicode import tcvn_to_unicode
from app.schemas.voucher import (
    VoucherHeaderSchema, VoucherDetailSchema, VoucherDetailResponse,
    VoucherListResponse, VoucherListPagination, VoucherSummary
)

logger = logging.getLogger("app.repositories.voucher")

class VoucherRepository:
    def __init__(self):
        self.vp_db = settings.DB_VP
        self.sys_db = settings.DB_SYS

    def _build_where(
        self,
        ma_ct: Optional[str] = "X1",
        ngay_ct1: Optional[str] = None,
        ngay_ct2: Optional[str] = None,
        so_ct1: Optional[str] = None,
        so_ct2: Optional[str] = None,
        ma_dt: Optional[str] = None,
        ma_bp: Optional[str] = None,
        ma_hd: Optional[str] = None,
        ma_nx: Optional[str] = None,
        ma_kho: Optional[str] = None,
        ma_vt: Optional[str] = None,
        ma_tte: Optional[str] = None,
        tk: Optional[str] = None,
        tk_du: Optional[str] = None,
        tien_nt1: Optional[float] = None,
        tien_nt2: Optional[float] = None,
        filter_by_user: Optional[str] = None,
    ) -> Tuple[str, List[Any]]:
        """
        Dựng mệnh đề WHERE dùng lại được (alias `h` = CtBH) + danh sách params.
        Tách riêng để tái sử dụng và dễ bảo trì.
        """
        where_clauses: List[str] = []
        params: List[Any] = []

        if ma_ct and ma_ct.strip().upper() not in ("ALL", ""):
            where_clauses.append("h.Ma_Ct = ?")
            params.append(ma_ct.strip().upper())
        else:
            where_clauses.append("h.Ma_Ct IN ('X1', 'BH')")

        if ngay_ct1:
            where_clauses.append("h.Ngay_Ct >= ?")
            params.append(ngay_ct1)
        if ngay_ct2:
            where_clauses.append("h.Ngay_Ct <= ?")
            params.append(ngay_ct2)
        if so_ct1:
            where_clauses.append("h.So_Ct >= ?")
            params.append(so_ct1)
        if so_ct2:
            where_clauses.append("h.So_Ct <= ?")
            params.append(so_ct2)
        if ma_dt:
            where_clauses.append("h.Ma_Dt = ?")
            params.append(ma_dt)
        if ma_bp:
            where_clauses.append("h.Ma_Bp = ?")
            params.append(ma_bp)
        if ma_hd:
            where_clauses.append("h.Ma_HD = ?")
            params.append(ma_hd)
        if ma_nx:
            where_clauses.append("h.Ma_Nx = ?")
            params.append(ma_nx)
        if ma_tte:
            where_clauses.append("h.Ma_Tte = ?")
            params.append(ma_tte)
        if tk:
            where_clauses.append("(h.Tk2 = ? OR h.Tk3 = ?)")
            params.extend([tk, tk])
        if tk_du:
            where_clauses.append("h.Tk_Du3 = ?")
            params.append(tk_du)
        if tien_nt1 is not None:
            where_clauses.append("h.TTien_Nt0 >= ?")
            params.append(tien_nt1)
        if tien_nt2 is not None:
            where_clauses.append("h.TTien_Nt0 <= ?")
            params.append(tien_nt2)
        if filter_by_user and filter_by_user.strip():
            where_clauses.append("h.UserName = ?")
            params.append(filter_by_user.strip())

        # Bộ lọc liên quan chi tiết (ma_kho, ma_vt). Alias `dv` để không đụng các query khác.
        detail_filters = []
        detail_params = []
        if ma_kho:
            detail_filters.append("dv.Ma_Kho = ?")
            detail_params.append(ma_kho)
        if ma_vt:
            detail_filters.append("dv.Ma_Vt = ?")
            detail_params.append(ma_vt)

        if detail_filters:
            where_clauses.append(f"""
                EXISTS (
                    SELECT 1 FROM {self.vp_db}.dbo.CtBH0 dv WITH (NOLOCK)
                    WHERE dv.Stt = h.Stt AND {" AND ".join(detail_filters)}
                )
            """)
            params.extend(detail_params)

        return " AND ".join(where_clauses), params

    def list_vouchers(
        self,
        ma_ct: Optional[str] = "X1",
        ngay_ct1: Optional[str] = None,
        ngay_ct2: Optional[str] = None,
        so_ct1: Optional[str] = None,
        so_ct2: Optional[str] = None,
        ma_dt: Optional[str] = None,
        ma_bp: Optional[str] = None,
        ma_hd: Optional[str] = None,
        ma_nx: Optional[str] = None,
        ma_kho: Optional[str] = None,
        ma_vt: Optional[str] = None,
        ma_tte: Optional[str] = None,
        tk: Optional[str] = None,
        tk_du: Optional[str] = None,
        tien_nt1: Optional[float] = None,
        tien_nt2: Optional[float] = None,
        filter_by_user: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> VoucherListResponse:
        """
        Query vouchers with filtering and pagination. 100% READ-ONLY (SELECT only).
        """
        page = max(1, page)
        page_size = max(1, min(page_size, 500))
        offset = (page - 1) * page_size

        where_sql, params = self._build_where(
            ma_ct=ma_ct,
            ngay_ct1=ngay_ct1,
            ngay_ct2=ngay_ct2,
            so_ct1=so_ct1,
            so_ct2=so_ct2,
            ma_dt=ma_dt,
            ma_bp=ma_bp,
            ma_hd=ma_hd,
            ma_nx=ma_nx,
            ma_kho=ma_kho,
            ma_vt=ma_vt,
            ma_tte=ma_tte,
            tk=tk,
            tk_du=tk_du,
            tien_nt1=tien_nt1,
            tien_nt2=tien_nt2,
            filter_by_user=filter_by_user,
        )

        # 1. Total counts and summary totals
        summary_sql = f"""
            SELECT
                COUNT(1) AS total_count,
                ISNULL(SUM(h.TTien_Nt), 0) AS total_ttien_nt,
                ISNULL(SUM(h.TTien_Nt2), 0) AS total_ttien_nt2,
                ISNULL(SUM(h.TTien_Nt3), 0) AS total_ttien_nt3,
                ISNULL(SUM(h.TTien_Nt4), 0) AS total_ttien_nt4,
                ISNULL(SUM(h.TTien_Nt0), 0) AS total_ttien_nt0,
                ISNULL(SUM(h.TTien), 0) AS total_ttien,
                ISNULL(SUM(h.TTien2), 0) AS total_ttien2,
                ISNULL(SUM(h.TTien3), 0) AS total_ttien3,
                ISNULL(SUM(h.TTien4), 0) AS total_ttien4,
                ISNULL(SUM(h.TTien0), 0) AS total_ttien0
            FROM {self.vp_db}.dbo.CtBH h WITH (NOLOCK)
            WHERE {where_sql}
        """

        # 2. Main data query (46 Header columns + joined names with SQL font conversion)
        data_sql = f"""
            SELECT
                h.Stt, h.Ma_DvCs, h.Ma_Ct, h.Nh_Ct, h.Ma_Tte, h.Ty_Gia,
                h.Ngay_Ps, h.Ngay_Ct, h.So_Ct, h.Ma_Xe, h.Ma_Bp, h.Ma_HD,
                h.Ma_Dt, h.Ma_Nx, h.Tk2, h.Tk3, h.Tk_Du3, h.Tk4,
                dbo.fn_TCVNToUnicode(h.Ong_Ba) AS Ong_Ba,
                dbo.fn_TCVNToUnicode(h.Dia_Chi) AS Dia_Chi,
                dbo.fn_TCVNToUnicode(h.Dien_Giai0) AS Dien_Giai0,
                dbo.fn_TCVNToUnicode(h.Desc_EN0) AS Desc_EN0,
                h.TTien_Nt, h.TTien_Nt0, h.TTien_Nt2, h.TTien_Nt3, h.TTien_Nt4,
                h.TTien, h.TTien0, h.TTien3, h.TTien2, h.TTien4,
                h.Loai_Ck, h.TyLeCK, h.Han_Tt, h.Ma_Thue, h.Thue_GTGT,
                h.Ma_DtGtGt,
                dbo.fn_TCVNToUnicode(h.Ten_DtGtGt) AS Ten_DtGtGt,
                h.So_Ct0, h.Ngay_Ct0, h.Stt_HBTL,
                h.Confirmed, h.Posted, h.Printed, h.UserName,
                dbo.fn_TCVNToUnicode(c.Ten_Dt) AS Ten_Dt,
                dbo.fn_TCVNToUnicode(x.Ten_Xe) AS Ten_Xe,
                dbo.fn_TCVNToUnicode(bp.Ten_Bp) AS Ten_Bp,
                dbo.fn_TCVNToUnicode(nx.Ten_Nx) AS Ten_Nx,
                dbo.fn_TCVNToUnicode(tk.Ten_Tk) AS Ten_Tk2,
                dbo.fn_TCVNToUnicode(hd.Ten_HD) AS Ten_HD
            FROM {self.vp_db}.dbo.CtBH h WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmDt c WITH (NOLOCK) ON c.Ma_Dt = h.Ma_Dt
            LEFT JOIN {self.sys_db}.dbo.DmXe x WITH (NOLOCK) ON x.Ma_Xe = h.Ma_Xe
            LEFT JOIN {self.sys_db}.dbo.DmBp bp WITH (NOLOCK) ON bp.Ma_Bp = h.Ma_Bp
            LEFT JOIN {self.sys_db}.dbo.DmNx nx WITH (NOLOCK) ON nx.Ma_Nx = h.Ma_Nx
            LEFT JOIN {self.sys_db}.dbo.DmTk tk WITH (NOLOCK) ON tk.Tk = h.Tk2
            LEFT JOIN {self.sys_db}.dbo.DmHD hd WITH (NOLOCK) ON hd.Ma_HD = h.Ma_HD
            WHERE {where_sql}
            ORDER BY h.Ngay_Ct DESC, h.So_Ct DESC, h.Stt DESC
            OFFSET {offset} ROWS FETCH NEXT {page_size} ROWS ONLY
        """

        total_records = 0
        summary = VoucherSummary()
        items: List[VoucherHeaderSchema] = []

        try:
            with get_db_cursor(self.vp_db) as cur:
                # Execute summary
                cur.execute(summary_sql, params)
                sum_row = cur.fetchone()
                if sum_row:
                    total_records = int(sum_row[0] or 0)
                    summary = VoucherSummary(
                        total_ttien_nt=float(sum_row[1] or 0.0),
                        total_ttien_nt2=float(sum_row[2] or 0.0),
                        total_ttien_nt3=float(sum_row[3] or 0.0),
                        total_ttien_nt4=float(sum_row[4] or 0.0),
                        total_ttien_nt0=float(sum_row[5] or 0.0),
                        total_ttien=float(sum_row[6] or 0.0),
                        total_ttien2=float(sum_row[7] or 0.0),
                        total_ttien3=float(sum_row[8] or 0.0),
                        total_ttien4=float(sum_row[9] or 0.0),
                        total_ttien0=float(sum_row[10] or 0.0),
                    )

                # Execute items
                cur.execute(data_sql, params)
                rows = cur.fetchall()
                for r in rows:
                    items.append(self._row_to_header_schema(r))
        except Exception as e:
            logger.error(f"Error querying vouchers: {e}")

        total_pages = math.ceil(total_records / page_size) if total_records > 0 else 1
        pagination = VoucherListPagination(
            page=page,
            page_size=page_size,
            total_records=total_records,
            total_pages=total_pages,
            has_next=page < total_pages
        )

        return VoucherListResponse(items=items, pagination=pagination, summary=summary)

    def get_voucher_detail(self, stt: str) -> Optional[VoucherDetailResponse]:
        """
        Get complete voucher details (46 Header cols + 35 Detail cols). 100% READ-ONLY.
        """
        header_sql = f"""
            SELECT
                h.Stt, h.Ma_DvCs, h.Ma_Ct, h.Nh_Ct, h.Ma_Tte, h.Ty_Gia,
                h.Ngay_Ps, h.Ngay_Ct, h.So_Ct, h.Ma_Xe, h.Ma_Bp, h.Ma_HD,
                h.Ma_Dt, h.Ma_Nx, h.Tk2, h.Tk3, h.Tk_Du3, h.Tk4,
                dbo.fn_TCVNToUnicode(h.Ong_Ba) AS Ong_Ba,
                dbo.fn_TCVNToUnicode(h.Dia_Chi) AS Dia_Chi,
                dbo.fn_TCVNToUnicode(h.Dien_Giai0) AS Dien_Giai0,
                dbo.fn_TCVNToUnicode(h.Desc_EN0) AS Desc_EN0,
                h.TTien_Nt, h.TTien_Nt0, h.TTien_Nt2, h.TTien_Nt3, h.TTien_Nt4,
                h.TTien, h.TTien0, h.TTien3, h.TTien2, h.TTien4,
                h.Loai_Ck, h.TyLeCK, h.Han_Tt, h.Ma_Thue, h.Thue_GTGT,
                h.Ma_DtGtGt,
                dbo.fn_TCVNToUnicode(h.Ten_DtGtGt) AS Ten_DtGtGt,
                h.So_Ct0, h.Ngay_Ct0, h.Stt_HBTL,
                h.Confirmed, h.Posted, h.Printed, h.UserName,
                dbo.fn_TCVNToUnicode(c.Ten_Dt) AS Ten_Dt,
                dbo.fn_TCVNToUnicode(x.Ten_Xe) AS Ten_Xe,
                dbo.fn_TCVNToUnicode(bp.Ten_Bp) AS Ten_Bp,
                dbo.fn_TCVNToUnicode(nx.Ten_Nx) AS Ten_Nx,
                dbo.fn_TCVNToUnicode(tk.Ten_Tk) AS Ten_Tk2,
                dbo.fn_TCVNToUnicode(hd.Ten_HD) AS Ten_HD
            FROM {self.vp_db}.dbo.CtBH h WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmDt c WITH (NOLOCK) ON c.Ma_Dt = h.Ma_Dt
            LEFT JOIN {self.sys_db}.dbo.DmXe x WITH (NOLOCK) ON x.Ma_Xe = h.Ma_Xe
            LEFT JOIN {self.sys_db}.dbo.DmBp bp WITH (NOLOCK) ON bp.Ma_Bp = h.Ma_Bp
            LEFT JOIN {self.sys_db}.dbo.DmNx nx WITH (NOLOCK) ON nx.Ma_Nx = h.Ma_Nx
            LEFT JOIN {self.sys_db}.dbo.DmTk tk WITH (NOLOCK) ON tk.Tk = h.Tk2
            LEFT JOIN {self.sys_db}.dbo.DmHD hd WITH (NOLOCK) ON hd.Ma_HD = h.Ma_HD
            WHERE h.Stt = ?
        """

        detail_sql = f"""
            SELECT
                d.Stt_PX, d.Stt0, d.Stt, d.Tk, d.Tk_Du, d.Tk_Du2, d.Tk_Du4,
                d.Ma_Kho, d.Ma_Vt, d.Dvt, d.Dvt_Ban, d.So_Tam, d.He_So8,
                d.So_Luong8, d.He_So9, d.So_Luong9, d.Gia_Nt9, d.Gia9,
                d.Tien_Nt9, d.Tien9, d.So_Luong, d.Gia_Nt, d.Gia, d.Tien_Nt,
                d.Tien, d.Gia_Nt2, d.Gia2, d.Tien_Nt2, d.Tien2, d.Tien_Nt3,
                d.Tien3, d.Chiet_Khau, d.Tien_Nt4, d.Tien4, d.Gia_Tb_TT,
                dbo.fn_TCVNToUnicode(v.Ten_Vt) AS Ten_Vt,
                dbo.fn_TCVNToUnicode(k.Ten_Kho) AS Ten_Kho,
                v.Loai_Vt
            FROM {self.vp_db}.dbo.CtBH0 d WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmVt v WITH (NOLOCK) ON v.Ma_Vt = d.Ma_Vt
            LEFT JOIN {self.sys_db}.dbo.DmKho k WITH (NOLOCK) ON k.Ma_Kho = d.Ma_Kho
            WHERE d.Stt = ?
            ORDER BY d.Stt0
        """

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(header_sql, [stt])
                h_row = cur.fetchone()
                if not h_row:
                    return None

                header_data = self._row_to_header_schema(h_row).model_dump()

                cur.execute(detail_sql, [stt])
                d_rows = cur.fetchall()
                items = [self._row_to_detail_schema(dr) for dr in d_rows]

                return VoucherDetailResponse(**header_data, items=items)
        except Exception as e:
            logger.error(f"Error querying voucher {stt}: {e}")
            return None

    def _row_to_header_schema(self, r: Any) -> VoucherHeaderSchema:
        return VoucherHeaderSchema(
            stt=(r[0] or "").strip(),
            ma_dvcs=(r[1] or "01").strip(),
            ma_ct=(r[2] or "X1").strip(),
            nh_ct=(r[3] or "2").strip(),
            ma_tte=(r[4] or "VND").strip(),
            ty_gia=float(r[5] or 1.0),
            ngay_ps=r[6].strftime("%Y-%m-%d") if r[6] else None,
            ngay_ct=r[7].strftime("%Y-%m-%d") if r[7] else "",
            so_ct=(r[8] or "").strip(),
            ma_xe=(r[9] or "").strip(),
            ma_bp=(r[10] or "").strip(),
            ma_hd=(r[11] or "").strip(),
            ma_dt=(r[12] or "").strip(),
            ma_nx=(r[13] or "131").strip(),
            tk2=(r[14] or "1311").strip(),
            tk3=(r[15] or "33311").strip(),
            tk_du3=(r[16] or "1311").strip(),
            tk4=(r[17] or "521").strip(),
            ong_ba=(r[18] or "").strip(),
            dia_chi=(r[19] or "").strip(),
            dien_giai0=(r[20] or "").strip(),
            desc_en0=(r[21] or "").strip(),
            ttien_nt=float(r[22] or 0.0),
            ttien_nt0=float(r[23] or 0.0),
            ttien_nt2=float(r[24] or 0.0),
            ttien_nt3=float(r[25] or 0.0),
            ttien_nt4=float(r[26] or 0.0),
            ttien=float(r[27] or 0.0),
            ttien0=float(r[28] or 0.0),
            ttien3=float(r[29] or 0.0),
            ttien2=float(r[30] or 0.0),
            ttien4=float(r[31] or 0.0),
            loai_ck=(r[32] or "1").strip(),
            tyle_ck=float(r[33] or 0.0),
            han_tt=int(r[34] or 0),
            ma_thue=(r[35] or "").strip(),
            thue_gtgt=float(r[36] or 0.0),
            ma_dtgtgt=(r[37] or "").strip(),
            ten_dtgtgt=(r[38] or "").strip(),
            so_ct0=(r[39] or "").strip(),
            ngay_ct0=r[40].strftime("%Y-%m-%d") if r[40] else None,
            stt_hbtl=(r[41] or "").strip(),
            confirmed=bool(r[42]),
            posted=bool(r[43]),
            printed=bool(r[44]),
            user_name=(r[45] or "").strip(),
            ten_dt=(r[46] or "").strip(),
            ten_xe=(r[47] or "").strip(),
            ten_bp=(r[48] or "").strip(),
            ten_nx=(r[49] or "").strip(),
            ten_tk2=(r[50] or "").strip(),
            ten_hd=(r[51] or "").strip(),
        )

    def _row_to_detail_schema(self, dr: Any) -> VoucherDetailSchema:
        return VoucherDetailSchema(
            stt_px=(dr[0] or "").strip() if dr[0] else None,
            stt0=(dr[1] or "").strip(),
            stt=(dr[2] or "").strip(),
            tk=(dr[3] or "632").strip(),
            tk_du=(dr[4] or "1561").strip(),
            tk_du2=(dr[5] or "5111").strip(),
            tk_du4=(dr[6] or "521").strip(),
            ma_kho=(dr[7] or "").strip(),
            ma_vt=(dr[8] or "").strip(),
            dvt=(dr[9] or "").strip(),
            dvt_ban=(dr[10] or "").strip(),
            so_tam=float(dr[11] or 0.0),
            he_so8=float(dr[12] or 1.0),
            so_luong8=float(dr[13] or 0.0),
            he_so9=float(dr[14] or 1.0),
            so_luong9=float(dr[15] or 0.0),
            gia_nt9=float(dr[16] or 0.0),
            gia9=float(dr[17] or 0.0),
            tien_nt9=float(dr[18] or 0.0),
            tien9=float(dr[19] or 0.0),
            so_luong=float(dr[20] or 0.0),
            gia_nt=float(dr[21] or 0.0),
            gia=float(dr[22] or 0.0),
            tien_nt=float(dr[23] or 0.0),
            tien=float(dr[24] or 0.0),
            gia_nt2=float(dr[25] or 0.0),
            gia2=float(dr[26] or 0.0),
            tien_nt2=float(dr[27] or 0.0),
            tien2=float(dr[28] or 0.0),
            tien_nt3=float(dr[29] or 0.0),
            tien3=float(dr[30] or 0.0),
            chiet_khau=float(dr[31] or 0.0),
            tien_nt4=float(dr[32] or 0.0),
            tien4=float(dr[33] or 0.0),
            gia_tb_tt=(dr[34] or "K").strip(),
            ten_vt=(dr[35] or "").strip(),
            ten_kho=(dr[36] or "").strip(),
            loai_vt=(dr[37] or "1").strip()
        )

voucher_repository = VoucherRepository()
