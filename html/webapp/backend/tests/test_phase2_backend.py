import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.services.calc_service import calc_service
from app.services.pickup_service import pickup_service
from app.repositories.voucher_repo import voucher_repository, increment_voucher_number
from app.schemas.calc import CalcRequest, CalcItemInput
from app.schemas.voucher import VoucherCreateRequest, VoucherUpdateRequest, VoucherDetailSchema, CheckNumberRequest
from app.utils.unicode import unicode_to_tcvn, tcvn_to_unicode

client = TestClient(app)

# ==============================================================================
# 1. TC-01 -> TC-07: BUSINESS CALCULATION TEST SUITE (calc_service & calc_loai2)
# ==============================================================================

def test_tc01_calc_loai2_mut_xop():
    """
    TC-01: Nhập hàng Mút: So_Tam=10, He_So8=2.5, Gia=100k
    Mong đợi: So_Luong8=25, Tien_Nt9=2.5M, không nhảy về 10.
    """
    req = CalcRequest(
        ma_tte="VND",
        ty_gia=1.0,
        thue_gtgt=10.0,
        loai_ck="1",
        items=[
            CalcItemInput(
                loai_vt="2",
                so_tam=10.0,
                he_so8=2.5,
                gia_nt9=100000.0,
                chiet_khau=0.0
            )
        ]
    )
    res = calc_service.calculate_voucher(req)
    item = res.items[0]
    assert item.so_luong8 == 25.0
    assert item.so_luong9 == 25.0
    assert item.so_luong == 25.0
    assert item.tien_nt9 == 2500000.0
    assert item.tien_nt2 == 2500000.0
    assert res.header.ttien_nt2 == 2500000.0
    assert res.header.ttien_nt3 == 250000.0
    assert res.header.ttien_nt0 == 2750000.0

def test_tc02_pickup_accept_calculation():
    """
    TC-02: Lấy đơn kho qua pickup, số lượng giữ nguyên 30, Tien_Nt9 = 3M.
    """
    with patch.object(pickup_service.repo, 'get_slip_header', return_value={"stt": "S1000001", "ma_xe": "29C-12345"}):
        with patch.object(pickup_service.repo, 'get_pickup_detail') as mock_detail:
            mock_item = MagicMock()
            mock_item.stt0 = "S10000010001"
            mock_item.ma_vt = "MUT_D25"
            mock_item.ten_vt = "Mút xốp D25"
            mock_item.dvt = "Tam"
            mock_item.dvt_ban = "Tam"
            mock_item.ma_kho = "KHO01"
            mock_item.so_tam = 15.0
            mock_item.he_so8 = 2.0
            mock_item.so_luong8 = 30.0
            mock_item.so_luong9 = 30.0
            mock_item.loai_vt = "2"
            mock_detail.return_value = MagicMock(items=[mock_item])

            with patch.object(pickup_service.repo, 'get_item_price', return_value=100000.0):
                with patch.object(pickup_service.repo, 'get_item_discount', return_value=0.0):
                    res = pickup_service.accept_pickup(
                        stts=["S1000001"],
                        ma_dt="KH001",
                        ngay_ct="2026-10-23",
                        ty_gia=1.0,
                        ma_tte="VND"
                    )
                    assert res.total_rows == 1
                    row = res.rows[0]
                    assert row.stt_px == "S1000001"
                    assert row.so_luong8 == 30.0
                    assert row.so_luong9 == 30.0
                    assert row.gia_nt9 == 100000.0
                    assert row.tien_nt9 == 3000000.0
                    assert res.ma_xe == "29C-12345"

def test_tc03_reverse_calculation_from_amount():
    """
    TC-03: Nhập ngược từ Thành tiền (TIEN_NT9):
    So_Tam=10, He_So8=2.5 (SL=25), Tien_Nt9=2,500,000 -> Gia_Nt9 = 100,000.
    """
    req = CalcRequest(
        ma_tte="VND",
        ty_gia=1.0,
        thue_gtgt=0.0,
        items=[
            CalcItemInput(
                loai_vt="2",
                so_tam=10.0,
                he_so8=2.5,
                tien_nt9=2500000.0,
                var_read="TIEN_NT9"
            )
        ]
    )
    res = calc_service.calculate_voucher(req)
    item = res.items[0]
    assert item.so_luong8 == 25.0
    assert item.gia_nt9 == 100000.0
    assert item.tien_nt9 == 2500000.0

def test_tc04_discount_zero_and_vat_recalc():
    """
    TC-04: Xóa CK về 0 có thuế: Tien_Nt4=0, thuế tính lại, TTien_Nt0 = TTien_Nt2 + TTien_Nt3.
    """
    req = CalcRequest(
        ma_tte="VND",
        ty_gia=1.0,
        thue_gtgt=10.0,
        loai_ck="1",
        items=[
            CalcItemInput(
                loai_vt="1",
                so_luong9=10.0,
                gia_nt9=100000.0,
                chiet_khau=0.0
            )
        ]
    )
    res = calc_service.calculate_voucher(req)
    item = res.items[0]
    assert item.tien_nt4 == 0.0
    assert item.tien_nt2 == 1000000.0
    assert res.header.ttien_nt4 == 0.0
    assert res.header.ttien_nt2 == 1000000.0
    assert res.header.ttien_nt3 == 100000.0
    # Invariant Fix #10:
    assert res.header.ttien_nt0 == 1100000.0
    assert res.header.ttien_nt0 == res.header.ttien_nt2 + res.header.ttien_nt3

def test_tc05_usd_promo_currency_trap_fix17():
    """
    TC-05: Hóa đơn USD giá $1–$10 có CK: CK giữ nguyên không bị xóa.
    Trong khi đó hóa đơn VND giá 1–10 VND thì CK bị ép về 0.
    """
    # 1. USD invoice: CK 5% must be PRESERVED
    req_usd = CalcRequest(
        ma_tte="USD",
        ty_gia=25000.0,
        thue_gtgt=0.0,
        items=[
            CalcItemInput(
                loai_vt="1",
                so_luong9=10.0,
                gia_nt9=5.0,  # $5
                chiet_khau=5.0
            )
        ]
    )
    res_usd = calc_service.calculate_voucher(req_usd)
    item_usd = res_usd.items[0]
    assert item_usd.chiet_khau == 5.0
    assert item_usd.tien_nt4 == 2.5  # 50 * 5% = 2.5 USD

    # 2. VND invoice: promo item 5 VND -> CK forced to 0
    req_vnd = CalcRequest(
        ma_tte="VND",
        ty_gia=1.0,
        thue_gtgt=0.0,
        items=[
            CalcItemInput(
                loai_vt="1",
                so_luong9=10.0,
                gia_nt9=5.0,  # 5 VND
                chiet_khau=5.0
            )
        ]
    )
    res_vnd = calc_service.calculate_voucher(req_vnd)
    item_vnd = res_vnd.items[0]
    assert item_vnd.chiet_khau == 0.0
    assert item_vnd.tien_nt4 == 0.0

def test_tc06_regular_item_conversion():
    """
    TC-06: Hàng thường Loai_Vt='1', He_So9=12, So_Luong9=5 -> So_Luong=60.
    """
    req = CalcRequest(
        ma_tte="VND",
        ty_gia=1.0,
        thue_gtgt=0.0,
        items=[
            CalcItemInput(
                loai_vt="1",
                so_luong9=5.0,
                he_so9=12.0,
                gia_nt9=20000.0,
                chiet_khau=0.0
            )
        ]
    )
    res = calc_service.calculate_voucher(req)
    item = res.items[0]
    assert item.so_luong9 == 5.0
    assert item.so_luong == 60.0
    assert item.tien_nt9 == 100000.0

def test_tc07_special_item_type3():
    """
    TC-07: Hàng đặc thù Loai_Vt='3' -> So_Luong3 chạy đúng (so_luong = so_luong9).
    """
    req = CalcRequest(
        ma_tte="VND",
        ty_gia=1.0,
        thue_gtgt=0.0,
        items=[
            CalcItemInput(
                loai_vt="3",
                so_luong9=8.0,
                gia_nt9=50000.0,
                chiet_khau=0.0
            )
        ]
    )
    res = calc_service.calculate_voucher(req)
    item = res.items[0]
    assert item.so_luong == 8.0
    assert item.so_luong8 == 0.0
    assert item.tien_nt9 == 400000.0

# ==============================================================================
# 2. AC-01 -> AC-08: ACID TRANSACTIONS & INTEGRITY TEST SUITE (MOCK DB)
# ==============================================================================

@pytest.fixture
def sample_voucher_request():
    return VoucherCreateRequest(
        ma_dvcs="S1",
        ma_ct="X1",
        nh_ct="2",
        ma_tte="VND",
        ty_gia=1.0,
        ngay_ct="2026-10-23",
        so_ct="HD4081",
        ma_dt="KH001",
        ma_nx="131",
        tk2="1311",
        tk3="33311",
        thue_gtgt=10.0,
        loai_ck="1",
        ong_ba="Nguyễn Văn A",
        dia_chi="123 Phố Huế, Hà Nội",
        dien_giai0="Bán mút xốp",
        items=[
            VoucherDetailSchema(
                ma_vt="MUT_D25",
                loai_vt="2",
                so_tam=10.0,
                he_so8=2.0,
                gia_nt9=100000.0,
                chiet_khau=0.0,
                ma_kho="KHO01",
                stt_px="S1000000000014763665"
            )
        ]
    )

def test_ac01_acid_rollback_on_detail_error(sample_voucher_request):
    """
    AC-01: Lỗi ghi Detail sau khi đã ghi Header.
    Đảm bảo gọi conn.rollback(), không gọi conn.commit(), dữ liệu không bị mồ côi.
    """
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    # Header insert succeeds (call 1), Detail insert raises (call 2)
    def cur_execute(query, params=None):
        if "INSERT INTO" in query and "dbo.CtBH0" in query:
            raise Exception("SQL Server Simulated Detail Error: FK violation")
        return None

    mock_cur.execute.side_effect = cur_execute

    with patch.object(voucher_repository, 'get_closing_date', return_value="2026-03-31"):
        with patch('app.repositories.debt_repo.debt_repository.get_customer_debt_summary') as mock_debt:
            mock_debt.return_value = MagicMock(is_over_limit=False, du_cuoi=0, gioi_han=100000000)
            with patch.object(voucher_repository, 'check_duplicate_number', return_value=(False, "HD4081")):
                with patch('app.repositories.voucher_repo.get_db_transaction') as mock_tx:
                    from contextlib import contextmanager
                    @contextmanager
                    def fake_tx(db_name=None):
                        try:
                            yield mock_conn, mock_cur
                            mock_conn.commit()
                        except Exception:
                            mock_conn.rollback()
                            raise

                    mock_tx.side_effect = fake_tx

                    with pytest.raises(Exception, match="SQL Server Simulated Detail Error"):
                        voucher_repository.save_voucher(sample_voucher_request, mode="M")

                    mock_conn.rollback.assert_called_once()
                    mock_conn.commit.assert_not_called()

def test_ac02_acid_rollback_on_edit_detail_error(sample_voucher_request):
    """
    AC-02: Sửa chứng từ (mode 'S'): xóa detail cũ rồi insert lỗi giữa chừng.
    Đảm bảo ROLLBACK — detail cũ không bị mất vĩnh viễn.
    """
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    def cur_execute(query, params=None):
        if "INSERT INTO" in query and "dbo.CtBH0" in query:
            raise Exception("Simulated detail insert failure in edit mode")
        return None

    mock_cur.execute.side_effect = cur_execute

    with patch.object(voucher_repository, 'get_closing_date', return_value="2026-03-31"):
        with patch('app.repositories.debt_repo.debt_repository.get_customer_debt_summary') as mock_debt:
            mock_debt.return_value = MagicMock(is_over_limit=False, du_cuoi=0, gioi_han=100000000)
            with patch.object(voucher_repository, 'check_duplicate_number', return_value=(False, "HD4081")):
                with patch('app.repositories.voucher_repo.get_db_transaction') as mock_tx:
                    from contextlib import contextmanager
                    @contextmanager
                    def fake_tx(db_name=None):
                        try:
                            yield mock_conn, mock_cur
                            mock_conn.commit()
                        except Exception:
                            mock_conn.rollback()
                            raise
                    mock_tx.side_effect = fake_tx

                    with pytest.raises(Exception, match="Simulated detail insert failure"):
                        voucher_repository.save_voucher(sample_voucher_request, mode="S", stt_override="S1000000000014763690")

                    mock_conn.rollback.assert_called_once()
                    mock_conn.commit.assert_not_called()

def test_ac03_duplicate_voucher_number_auto_increment():
    """
    AC-03: Chống trùng số chứng từ: nếu số HD4081 bị trùng thì tự tăng lên HD4082.
    """
    assert increment_voucher_number("HD4081") == "HD4082"
    assert increment_voucher_number("BH009") == "BH010"
    assert increment_voucher_number("HD99") == "HD100"

    # Test duplicate loop logic
    mock_cur = MagicMock()
    # First attempt: duplicate (True), second attempt: available (False)
    mock_cur.fetchone.side_effect = [(True,), (False,)]

    is_dup, final_no = voucher_repository.check_duplicate_number(
        ma_dvcs="S1",
        moi_sua="M",
        stt="",
        ma_ct="X1",
        ngay_ct="2026-10-23",
        so_ct="HD4081",
        cur=mock_cur
    )
    assert is_dup is True
    assert final_no == "HD4082"

def test_ac04_header_detail_sums_mismatch_assertion(sample_voucher_request):
    """
    AC-04: Header ⟷ Detail lệch tiền sau khi ghi: bị chặn trước COMMIT (assert), không lưu.
    """
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    # When integrity assertion queries SUM(Tien_Nt2) from CtBH0, return mismatched sum
    mock_cur.fetchone.return_value = (9999999.0, 9999999.0, 1)

    with patch.object(voucher_repository, 'get_closing_date', return_value="2026-03-31"):
        with patch('app.repositories.debt_repo.debt_repository.get_customer_debt_summary') as mock_debt:
            mock_debt.return_value = MagicMock(is_over_limit=False, du_cuoi=0, gioi_han=100000000)
            with patch.object(voucher_repository, 'check_duplicate_number', return_value=(False, "HD4081")):
                with patch('app.repositories.voucher_repo.get_db_transaction') as mock_tx:
                    from contextlib import contextmanager
                    @contextmanager
                    def fake_tx(db_name=None):
                        try:
                            yield mock_conn, mock_cur
                            mock_conn.commit()
                        except Exception:
                            mock_conn.rollback()
                            raise
                    mock_tx.side_effect = fake_tx

                    with pytest.raises(AssertionError, match="Lệch tổng tiền Header và Detail"):
                        voucher_repository.save_voucher(sample_voucher_request, mode="M")

                    mock_conn.rollback.assert_called_once()
                    mock_conn.commit.assert_not_called()

def test_ac05_cogs_fields_never_overwritten_fix21(sample_voucher_request):
    """
    AC-05: Kiểm tra Fix #21: 4 cột giá vốn (Gia_Nt, Gia, Tien_Nt, Tien)
    LUÔN BẰNG 0 và không bao giờ bị gán bằng đơn giá bán.
    """
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    executed_params = []

    def cur_execute(query, params=None):
        if params and "INSERT INTO" in query and "dbo.CtBH0" in query:
            executed_params.append(params)
        return None

    mock_cur.execute.side_effect = cur_execute
    # Detail integrity check passes
    mock_cur.fetchone.return_value = (2000000.0, 2000000.0, 1)

    with patch.object(voucher_repository, 'get_closing_date', return_value="2026-03-31"):
        with patch('app.repositories.debt_repo.debt_repository.get_customer_debt_summary') as mock_debt:
            mock_debt.return_value = MagicMock(is_over_limit=False, du_cuoi=0, gioi_han=100000000)
            with patch.object(voucher_repository, 'check_duplicate_number', return_value=(False, "HD4081")):
                with patch('app.repositories.voucher_repo.get_db_transaction') as mock_tx:
                    from contextlib import contextmanager
                    @contextmanager
                    def fake_tx(db_name=None):
                        yield mock_conn, mock_cur
                        mock_conn.commit()
                    mock_tx.side_effect = fake_tx

                    voucher_repository.save_voucher(sample_voucher_request, mode="M")

                    assert len(executed_params) == 1
                    p = executed_params[0]
                    # Columns in INSERT CtBH0:
                    # 20: so_luong, 21: gia_nt, 22: gia, 23: tien_nt, 24: tien
                    gia_nt = p[21]
                    gia = p[22]
                    tien_nt = p[23]
                    tien = p[24]
                    assert gia_nt == 0.0
                    assert gia == 0.0
                    assert tien_nt == 0.0
                    assert tien == 0.0
                    # Ensure they are NOT equal to selling price
                    gia_nt9 = p[16]
                    assert gia_nt9 == 100000.0
                    assert gia_nt != gia_nt9

def test_ac06_closing_date_protection(sample_voucher_request):
    """
    AC-06: Chốt 1 (Khóa sổ): Nếu Ngay_Ct <= Ngay_Kt_Ht thì chặn lưu.
    """
    # Set closing date to 2026-10-31 (future relative to voucher date 2026-10-23)
    with patch.object(voucher_repository, 'get_closing_date', return_value="2026-10-31"):
        with pytest.raises(ValueError, match="nằm trong kỳ đã khóa sổ"):
            voucher_repository.save_voucher(sample_voucher_request, mode="M")

def test_ac07_credit_limit_protection(sample_voucher_request):
    """
    AC-07: Chốt 3 (Hạn mức công nợ): Nếu dư nợ >= giới hạn nợ thì chặn lưu.
    """
    with patch.object(voucher_repository, 'get_closing_date', return_value="2026-03-31"):
        with patch('app.repositories.debt_repo.debt_repository.get_customer_debt_summary') as mock_debt:
            mock_debt.return_value = MagicMock(
                is_over_limit=True,
                du_cuoi=150000000.0,
                gioi_han=100000000.0
            )
            with pytest.raises(ValueError, match="vượt quá hạn mức nợ cho phép"):
                voucher_repository.save_voucher(sample_voucher_request, mode="M")

def test_ac08_unicode_tcvn_roundtrip():
    """
    AC-08: Ghi text tiếng Việt và đọc lại: khớp bảng mã TCVN3 / Unicode.
    """
    test_str = "Công ty TNHH Mút Xốp Việt Nam - Đơn hàng đặc biệt"
    tcvn = unicode_to_tcvn(test_str)
    assert tcvn != test_str  # Converted to TCVN3 characters
    decoded = tcvn_to_unicode(tcvn)
    assert decoded == test_str  # 100% round-trip match

# ==============================================================================
# 3. FASTAPI CRUD API ENDPOINT TESTS (TestClient)
# ==============================================================================

def test_api_create_voucher_endpoint(sample_voucher_request):
    with patch.object(voucher_repository, 'save_voucher') as mock_save:
        from app.schemas.voucher import VoucherSaveResponse
        mock_save.return_value = VoucherSaveResponse(stt="S1000000000014763690", so_ct="HD4081")

        resp = client.post("/api/vouchers", json=sample_voucher_request.model_dump())
        assert resp.status_code == 201
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["stt"] == "S1000000000014763690"
        assert data["data"]["so_ct"] == "HD4081"

def test_api_update_voucher_endpoint(sample_voucher_request):
    update_req = VoucherUpdateRequest(**sample_voucher_request.model_dump(), stt="S1000000000014763690")
    with patch.object(voucher_repository, 'save_voucher') as mock_save:
        from app.schemas.voucher import VoucherSaveResponse
        mock_save.return_value = VoucherSaveResponse(stt="S1000000000014763690", so_ct="HD4081")

        resp = client.put("/api/vouchers/S1000000000014763690", json=update_req.model_dump())
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["stt"] == "S1000000000014763690"

def test_api_delete_voucher_endpoint():
    with patch.object(voucher_repository, 'delete_voucher') as mock_del:
        from app.schemas.voucher import VoucherDeleteResponse
        mock_del.return_value = VoucherDeleteResponse(stt="S1000000000014763690")

        resp = client.delete("/api/vouchers/S1000000000014763690")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["stt"] == "S1000000000014763690"

def test_api_check_number_endpoint():
    with patch.object(voucher_repository, 'check_duplicate_number', return_value=(False, "HD4081")):
        payload = {
            "ma_dvcs": "S1",
            "moi_sua": "M",
            "stt": "",
            "ma_ct": "X1",
            "ngay_ct": "2026-10-23",
            "so_ct": "HD4081"
        }
        resp = client.post("/api/vouchers/check-number", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["is_duplicate"] is False
        assert data["data"]["valid_so_ct"] == "HD4081"

def test_delete_voucher_success():
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    import datetime
    # In VP_2014, Confirmed is 1 (True), Post is 1 (True), date is 2026-10-23
    mock_cur.fetchone.return_value = (True, True, datetime.datetime(2026, 10, 23, 0, 0))

    sp_calls = []
    def cur_execute(query, params=None):
        if "CtBH_Delete" in query:
            sp_calls.append(params)
        return None

    mock_cur.execute.side_effect = cur_execute

    with patch.object(voucher_repository, 'get_closing_date', return_value="2026-03-31"):
        with patch('app.repositories.voucher_repo.get_db_transaction') as mock_tx:
            from contextlib import contextmanager
            @contextmanager
            def fake_tx(db_name=None):
                yield mock_conn, mock_cur
                mock_conn.commit()
            mock_tx.side_effect = fake_tx

            res = voucher_repository.delete_voucher("S1000000000014763690")
            assert res.stt == "S1000000000014763690"
            assert len(sp_calls) == 1
            assert sp_calls[0] == ["S1000000000014763690", "KTCN3"]

def test_delete_voucher_locked_period_blocked():
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    import datetime
    # Not confirmed, date 2026-03-01
    mock_cur.fetchone.return_value = (False, True, datetime.datetime(2026, 3, 1, 0, 0))

    with patch.object(voucher_repository, 'get_closing_date', return_value="2026-03-31"):
        with patch('app.repositories.voucher_repo.get_db_transaction') as mock_tx:
            from contextlib import contextmanager
            @contextmanager
            def fake_tx(db_name=None):
                yield mock_conn, mock_cur
                mock_conn.commit()
            mock_tx.side_effect = fake_tx

            with pytest.raises(ValueError, match="trong kỳ đã khóa sổ"):
                voucher_repository.delete_voucher("S1000000000014763690")

