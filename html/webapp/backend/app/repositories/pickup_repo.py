import logging
from typing import List, Optional
from app.config import settings
from app.database import get_db_cursor
from app.utils.unicode import tcvn_to_unicode
from app.schemas.pickup import PickupSlipSchema, PickupItemSchema, PickupDetailResponse

logger = logging.getLogger("app.repositories.pickup")

class PickupRepository:
    def __init__(self):
        self.kh_db = settings.DB_KH
        self.sys_db = settings.DB_SYS

    def list_ready_to_pickup(
        self,
        ma_dt: Optional[str] = None,
        ngay_ct1: Optional[str] = None,
        ngay_ct2: Optional[str] = None
    ) -> List[PickupSlipSchema]:
        """
        List pickup warehouse slips from KH_2014 that have un-invoiced items (Stt_PX IS NULL).
        100% READ-ONLY (SELECT only).
        """
        where_clauses = ["h.Confirmed = 1"]
        params = []

        if ma_dt:
            where_clauses.append("h.Ma_Dt = ?")
            params.append(ma_dt)
        if ngay_ct1:
            where_clauses.append("h.Ngay_Ct >= ?")
            params.append(ngay_ct1)
        if ngay_ct2:
            where_clauses.append("h.Ngay_Ct <= ?")
            params.append(ngay_ct2)

        # Ensure only slips with at least 1 item not yet picked up
        where_clauses.append(f"""
            EXISTS (
                SELECT 1 FROM {self.kh_db}.dbo.CtBH0 d WITH (NOLOCK)
                WHERE d.Stt = h.Stt AND (d.Stt_PX IS NULL OR d.Stt_PX = '')
            )
        """)

        where_sql = " AND ".join(where_clauses)

        sql = f"""
            SELECT
                h.Stt, h.So_Ct, h.Ngay_Ct, h.Ma_Dt, h.Dia_Chi, h.Ma_Xe,
                c.Ten_Dt,
                COUNT(d.Stt0) AS total_items,
                ISNULL(SUM(d.So_Tam), 0) AS total_so_tam,
                ISNULL(SUM(d.So_Luong9), 0) AS total_so_luong9
            FROM {self.kh_db}.dbo.CtBH h WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmDt c WITH (NOLOCK) ON c.Ma_Dt = h.Ma_Dt
            JOIN {self.kh_db}.dbo.CtBH0 d WITH (NOLOCK) ON d.Stt = h.Stt
            WHERE {where_sql} AND (d.Stt_PX IS NULL OR d.Stt_PX = '')
            GROUP BY h.Stt, h.So_Ct, h.Ngay_Ct, h.Ma_Dt, h.Dia_Chi, h.Ma_Xe, c.Ten_Dt
            ORDER BY h.Ngay_Ct DESC, h.So_Ct DESC
        """

        results: List[PickupSlipSchema] = []
        try:
            with get_db_cursor(self.kh_db) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
                for r in rows:
                    results.append(PickupSlipSchema(
                        stt=(r[0] or "").strip(),
                        so_ct=(r[1] or "").strip(),
                        ngay_ct=r[2].strftime("%Y-%m-%d") if r[2] else "",
                        ma_dt=(r[3] or "").strip(),
                        dia_chi=tcvn_to_unicode(r[4]),
                        ma_xe=(r[5] or "").strip(),
                        ten_dt=tcvn_to_unicode(r[6]),
                        total_items=int(r[7] or 0),
                        total_so_tam=float(r[8] or 0.0),
                        total_so_luong9=float(r[9] or 0.0)
                    ))
        except Exception as e:
            logger.error(f"Error querying pickup slips from {self.kh_db}: {e}")

        return results

    def get_pickup_detail(self, stt: str) -> Optional[PickupDetailResponse]:
        """
        Get items of a pickup slip from KH_2014.dbo.CtBH0. 100% READ-ONLY (SELECT only).
        """
        sql = f"""
            SELECT
                d.Stt0, d.Stt, d.Ma_Vt, d.Dvt, d.Dvt_Ban, d.Ma_Kho,
                ISNULL(d.So_Tam, 0) AS So_Tam,
                ISNULL(d.He_So8, 1) AS He_So8,
                ISNULL(d.So_Luong8, 0) AS So_Luong8,
                ISNULL(d.So_Luong9, 0) AS So_Luong9,
                v.Ten_Vt, ISNULL(v.Loai_Vt, '1') AS Loai_Vt
            FROM {self.kh_db}.dbo.CtBH0 d WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmVt v WITH (NOLOCK) ON v.Ma_Vt = d.Ma_Vt
            WHERE d.Stt = ? AND (d.Stt_PX IS NULL OR d.Stt_PX = '')
            ORDER BY d.Stt0
        """

        items: List[PickupItemSchema] = []
        try:
            with get_db_cursor(self.kh_db) as cur:
                cur.execute(sql, [stt])
                rows = cur.fetchall()
                for r in rows:
                    items.append(PickupItemSchema(
                        stt0=(r[0] or "").strip(),
                        stt=(r[1] or "").strip(),
                        ma_vt=(r[2] or "").strip(),
                        dvt=(r[3] or "").strip(),
                        dvt_ban=(r[4] or "").strip(),
                        ma_kho=(r[5] or "").strip(),
                        so_tam=float(r[6] or 0.0),
                        he_so8=float(r[7] or 1.0),
                        so_luong8=float(r[8] or 0.0),
                        so_luong9=float(r[9] or 0.0),
                        ten_vt=tcvn_to_unicode(r[10]),
                        loai_vt=(r[11] or "1").strip()
                    ))
            return PickupDetailResponse(stt=stt, items=items)
        except Exception as e:
            logger.error(f"Error querying pickup detail for {stt}: {e}")
            return PickupDetailResponse(stt=stt, items=[])

pickup_repository = PickupRepository()
