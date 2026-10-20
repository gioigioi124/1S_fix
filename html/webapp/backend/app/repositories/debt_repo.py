import logging
from typing import List, Optional
from app.config import settings
from app.database import get_db_cursor
from app.utils.unicode import tcvn_to_unicode
from app.schemas.debt import CustomerDebtSummary, DebtDetailResponse, DebtTransaction

logger = logging.getLogger("app.repositories.debt")

class DebtRepository:
    def __init__(self):
        self.vp_db = settings.DB_VP
        self.sys_db = settings.DB_SYS

    def get_customer_debt_summary(self, ma_dt: str, tk: str = "131") -> CustomerDebtSummary:
        """
        Query customer realtime debt and credit limit according to Fix #1, #2, #3.
        100% READ-ONLY (SELECT only).
        """
        limit_sql = f"""
            SELECT Ten_Dt, ISNULL(Gioi_Han, 0) AS Gioi_Han, ISNULL(Toi_Han, 0) AS Toi_Han
            FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK)
            WHERE Ma_Dt = ?
        """

        balance_sql = f"""
            SELECT
                ISNULL(SUM(Ps_No), 0) AS total_ps_no,
                ISNULL(SUM(Ps_Co), 0) AS total_ps_co,
                ISNULL(SUM(Ps_No_Nt), 0) AS total_ps_no_nt,
                ISNULL(SUM(Ps_Co_Nt), 0) AS total_ps_co_nt
            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
            WHERE Ma_Dt = ? AND Tk LIKE ?
        """

        ten_dt = ""
        gioi_han = 0.0
        toi_han = 0.0
        ps_no = 0.0
        ps_co = 0.0
        ps_no_nt = 0.0
        ps_co_nt = 0.0

        try:
            with get_db_cursor(self.sys_db) as cur:
                cur.execute(limit_sql, [ma_dt])
                r = cur.fetchone()
                if r:
                    ten_dt = tcvn_to_unicode(r[0])
                    gioi_han = float(r[1] or 0.0)
                    toi_han = float(r[2] or 0.0)
        except Exception as e:
            logger.warning(f"Error querying DmDt for debt limit: {e}")

        try:
            with get_db_cursor(self.vp_db) as cur:
                tk_param = f"{tk}%"
                cur.execute(balance_sql, [ma_dt, tk_param])
                r = cur.fetchone()
                if r:
                    ps_no = float(r[0] or 0.0)
                    ps_co = float(r[1] or 0.0)
                    ps_no_nt = float(r[2] or 0.0)
                    ps_co_nt = float(r[3] or 0.0)
        except Exception as e:
            logger.warning(f"Error querying SoCai for balance: {e}")

        du_cuoi = ps_no - ps_co
        du_cuoi_nt = ps_no_nt - ps_co_nt

        is_over_limit = (gioi_han > 0 and du_cuoi >= gioi_han)
        # Fix #3: Only warn near limit if Toi_Han <> 0
        is_near_limit = (toi_han > 0 and du_cuoi >= toi_han and not is_over_limit)

        if is_over_limit:
            status_msg = f"Quá giới hạn nợ! ({du_cuoi:,.0f} >= {gioi_han:,.0f})"
        elif is_near_limit:
            status_msg = f"Đến hạn mức thanh toán! ({du_cuoi:,.0f} >= {toi_han:,.0f})"
        else:
            status_msg = "Trong hạn mức an toàn"

        return CustomerDebtSummary(
            ma_dt=ma_dt,
            ten_dt=ten_dt,
            tk=tk,
            du_no=ps_no,
            du_co=ps_co,
            du_no_nt=ps_no_nt,
            du_co_nt=ps_co_nt,
            du_cuoi=du_cuoi,
            gioi_han=gioi_han,
            toi_han=toi_han,
            is_over_limit=is_over_limit,
            is_near_limit=is_near_limit,
            status_message=status_msg
        )

    def get_voucher_debt_detail(self, stt: str) -> DebtDetailResponse:
        """
        Get detailed debt transactions for a customer related to a voucher. 100% READ-ONLY.
        """
        voucher_sql = f"""
            SELECT h.Ma_Dt, c.Ten_Dt, h.So_Ct, h.Ngay_Ct, ISNULL(h.TTien_Nt0, 0) AS TTien_Nt0, ISNULL(h.TTien0, 0) AS TTien0
            FROM {self.vp_db}.dbo.CtBH h WITH (NOLOCK)
            LEFT JOIN {self.sys_db}.dbo.DmDt c WITH (NOLOCK) ON c.Ma_Dt = h.Ma_Dt
            WHERE h.Stt = ?
        """

        ma_dt = ""
        ten_dt = ""
        so_ct = ""
        ngay_ct = ""
        tong_no = 0.0

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(voucher_sql, [stt])
                r = cur.fetchone()
                if r:
                    ma_dt = (r[0] or "").strip()
                    ten_dt = tcvn_to_unicode(r[1])
                    so_ct = (r[2] or "").strip()
                    ngay_ct = r[3].strftime("%Y-%m-%d") if r[3] else ""
                    tong_no = float(r[5] or r[4] or 0.0)
        except Exception as e:
            logger.warning(f"Error querying voucher header for debt detail: {e}")

        # Query transactions from SoCai for this customer
        tx_sql = f"""
            SELECT TOP 50
                Ngay_Ct, So_Ct, Dien_Giai,
                ISNULL(Ps_No, 0) AS Ps_No,
                ISNULL(Ps_Co, 0) AS Ps_Co,
                ISNULL(Ps_No_Nt, 0) AS Ps_No_Nt,
                ISNULL(Ps_Co_Nt, 0) AS Ps_Co_Nt
            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
            WHERE Ma_Dt = ? AND Tk LIKE '131%'
            ORDER BY Ngay_Ct DESC, So_Ct DESC
        """

        transactions: List[DebtTransaction] = []
        da_thanh_toan = 0.0
        try:
            if ma_dt:
                with get_db_cursor(self.vp_db) as cur:
                    cur.execute(tx_sql, [ma_dt])
                    rows = cur.fetchall()
                    for tr in rows:
                        p_co = float(tr[4] or 0.0)
                        da_thanh_toan += p_co
                        transactions.append(DebtTransaction(
                            ngay_ct=tr[0].strftime("%Y-%m-%d") if tr[0] else "",
                            so_ct=(tr[1] or "").strip(),
                            dien_giai=tcvn_to_unicode(tr[2]),
                            ps_no=float(tr[3] or 0.0),
                            ps_co=p_co,
                            ps_no_nt=float(tr[5] or 0.0),
                            ps_co_nt=float(tr[6] or 0.0)
                        ))
        except Exception as e:
            logger.warning(f"Error querying SoCai transactions: {e}")

        con_lai = max(0.0, tong_no - da_thanh_toan)

        return DebtDetailResponse(
            ma_dt=ma_dt,
            ten_dt=ten_dt,
            stt=stt,
            so_ct=so_ct,
            ngay_ct=ngay_ct,
            tong_no=tong_no,
            da_thanh_toan=da_thanh_toan,
            con_lai=con_lai,
            transactions=transactions
        )

debt_repository = DebtRepository()
