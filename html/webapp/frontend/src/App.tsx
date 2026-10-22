import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useVouchers } from "./hooks/useVouchers";
import { useHotkeys } from "./hooks/useHotkeys";
import { VoucherList } from "./components/VoucherList";
import { VoucherForm } from "./components/VoucherForm";
import { FilterDialog } from "./components/FilterDialog";
import { PickupDialog } from "./components/PickupDialog";
import { DebtPanel } from "./components/DebtPanel";
import { PrintPreview } from "./components/PrintPreview";
import { Badge } from "./components/ui/Badge";
import { formatDate } from "./lib/format";
import { User, ShieldCheck, Search, RefreshCw } from "lucide-react";

export function App() {
  const {
    vouchers,
    pagination,
    filters,
    loading,
    selectedStt,
    setSelectedStt,
    listDetail,
    listDetailLoading,
    debtAmount,
    activeVoucher,
    handleOpenDetail,
    handleCloseDetail,
    isFilterOpen,
    setIsFilterOpen,
    handleApplyFilter,
    handleChangePage,
    refresh,
    isPrintOpen,
    setIsPrintOpen,
    printStt,
    handleOpenPrint,
    isPickupOpen,
    setIsPickupOpen,
    isDebtOpen,
    setIsDebtOpen,
    debtMaDt,
    handleOpenDebt,
  } = useVouchers();

  const [notification, setNotification] = useState<string | null>(null);
  // Đánh dấu dòng (Mark) giống ctbhh — Space / Ctrl+A / Ctrl+U tác động.
  const [marked, setMarked] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleMark = (stt: string | null) => {
    if (!stt) return;
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(stt)) next.delete(stt);
      else next.add(stt);
      return next;
    });
  };

  // ==== Đồng bộ URL route (/sales-invoices/:stt) ↔ chứng từ đang mở ====
  const { stt: sttParam } = useParams();
  const navigate = useNavigate();
  const navToDetail = (stt: string) =>
    navigate(`/sales-invoices/${encodeURIComponent(stt)}`);
  const navToList = () => navigate("/sales-invoices");

  useEffect(() => {
    if (sttParam) {
      if (activeVoucher?.stt !== sttParam) handleOpenDetail(sttParam);
    } else if (activeVoucher) {
      handleCloseDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sttParam]);

  // VFP Keyboard Shortcuts Handler (khớp ctbhh / ctbhd / ctbhch)
  useHotkeys({
    // F2 = Thêm mới (ctbhh Command1) — khóa ở GĐ1
    onF2: () =>
      showToast("F2 - Thêm mới bị khóa trong Giai đoạn 1 (100% Read-Only)."),
    onCtrlF2: () =>
      showToast("Ctrl+F2 - Thêm mới (SaveAs) bị khóa trong Giai đoạn 1."),
    // F3 = Sửa (ctbhh Command2) — khóa ở GĐ1
    onF3: () =>
      showToast(
        "F3 - Sửa chứng từ bị khóa trong Giai đoạn 1 (100% Read-Only).",
      ),
    onCtrlF3: () =>
      showToast("Ctrl+F3 - Sửa mẫu in bị khóa trong Giai đoạn 1."),
    // F6 = Nhập số IMEI — khóa ở GĐ1
    onF6: () => showToast("F6 - Nhập số IMEI bị khóa trong Giai đoạn 1."),
    // F7 = In chứng từ (ctbhh Command5)
    onF7: () => {
      if (activeVoucher) handleOpenPrint(activeVoucher.stt);
      else if (selectedStt) handleOpenPrint(selectedStt);
      else showToast("Chưa chọn chứng từ để in.");
    },
    // Shift+F7 / Ctrl+F7 = Xem trước (ctbhh Command4)
    onPreview: () => {
      if (activeVoucher) handleOpenPrint(activeVoucher.stt);
      else if (selectedStt) handleOpenPrint(selectedStt);
      else showToast("Chưa chọn chứng từ để xem trước.");
    },
    // F8 = Xóa (ctbhh Command3) — khóa ở GĐ1
    onF8: () =>
      showToast(
        "F8 - Xóa chứng từ bị khóa trong Giai đoạn 1 (100% Read-Only).",
      ),
    // F9 = Lọc chứng từ (ctbhh Command6)
    onF9: () => setIsFilterOpen(true),
    // F4 = Chọn tài khoản — chỉ có nghĩa trong form nhập liệu (ctbhd), GĐ1 khóa
    onF4: () => {
      if (activeVoucher)
        showToast("F4 - Chọn tài khoản bị khóa trong Giai đoạn 1.");
    },
    // Space = đánh dấu / bỏ đánh dấu dòng (ctbhh KeyPress 32)
    onSpace: () => toggleMark(selectedStt),
    // Ctrl+A = chọn tất cả dòng (Mark = .T.)
    onCtrlA: () => {
      setMarked(new Set(vouchers.map((v) => v.stt)));
      showToast(`Đã chọn tất cả ${vouchers.length} chứng từ.`);
    },
    // Ctrl+U = bỏ chọn tất cả dòng (Mark = .F.)
    onCtrlU: () => {
      setMarked(new Set());
      showToast("Đã bỏ chọn tất cả chứng từ.");
    },
    // Ctrl+F = Đánh số chứng từ (Danh_So_Ct) — GĐ1 chỉ thông báo
    onCtrlF: () =>
      showToast("Ctrl+F - Đánh số chứng từ (Danh_So_Ct) — Giai đoạn 2."),
    // Enter = mở chi tiết dòng đang chọn (tương đương double-click)
    onEnter: () => {
      if (!activeVoucher && selectedStt) {
        navToDetail(selectedStt);
      }
    },
    onEscape: () => {
      if (isPrintOpen) {
        setIsPrintOpen(false);
      } else if (isDebtOpen) {
        setIsDebtOpen(false);
      } else if (isPickupOpen) {
        setIsPickupOpen(false);
      } else if (isFilterOpen) {
        setIsFilterOpen(false);
      } else if (activeVoucher) {
        navToList();
      }
    },
    onCtrlHome: () => {
      if (vouchers.length > 0) setSelectedStt(vouchers[0].stt);
    },
    onCtrlEnd: () => {
      if (vouchers.length > 0)
        setSelectedStt(vouchers[vouchers.length - 1].stt);
    },
  });

  const handleHotkeyBarAction = (actionId: string) => {
    switch (actionId) {
      case "NEW":
        showToast("F2 - Thêm mới bị khóa trong Giai đoạn 1 (100% Read-Only).");
        break;
      case "EDIT":
        showToast(
          "F3 - Sửa chứng từ bị khóa trong Giai đoạn 1 (100% Read-Only).",
        );
        break;
      case "IMEI":
        showToast("F6 - Nhập số IMEI bị khóa trong Giai đoạn 1.");
        break;
      case "DELETE":
        showToast(
          "F8 - Xóa chứng từ bị khóa trong Giai đoạn 1 (100% Read-Only).",
        );
        break;
      case "FILTER":
        setIsFilterOpen(true);
        break;
      case "PRINT":
      case "PREVIEW":
        if (activeVoucher) handleOpenPrint(activeVoucher.stt);
        else if (selectedStt) handleOpenPrint(selectedStt);
        else showToast("Chưa chọn chứng từ.");
        break;
      case "TOGGLE_MARK":
        toggleMark(selectedStt);
        break;
      case "SELECT_ALL":
        setMarked(new Set(vouchers.map((v) => v.stt)));
        break;
      case "DESELECT_ALL":
        setMarked(new Set());
        break;
      case "ESCAPE":
        if (isPrintOpen) setIsPrintOpen(false);
        else if (isDebtOpen) setIsDebtOpen(false);
        else if (isPickupOpen) setIsPickupOpen(false);
        else if (isFilterOpen) setIsFilterOpen(false);
        else if (activeVoucher) navToList();
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-neutral-900 text-white px-4 py-2 rounded shadow-lg text-xs flex items-center gap-2 border border-neutral-700">
          <ShieldCheck className="w-4 h-4 text-tertiary-300" />
          <span>{notification}</span>
        </div>
      )}

      {/* ===== Top Global Header (ẩn khi đang mở form Sửa chứng từ) ===== */}
      {!activeVoucher && (
        <header className="bg-neutral-900 text-neutral-200 border-b border-neutral-700 flex-shrink-0 z-30">
          <div className="px-3.5 py-1.5 flex items-center justify-between gap-4">
            {/* Logo, Breadcrumb & Tiêu đề màn hình */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-7 h-7 rounded bg-primary-700 text-white font-bold text-sm shadow">
                PX
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-600">/</span>
                <h1 className="text-sm font-semibold text-white tracking-wide">
                  Phiếu Xuất Bán
                </h1>
                <Badge variant="warning" className="ml-1 font-mono text-[10px]">
                  GĐ1: READ-ONLY
                </Badge>
              </div>
            </div>

            {/* Khung tìm kiếm & bộ lọc kỳ kế toán nhanh */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded text-xs text-neutral-300">
                <span className="font-mono text-[11px]">
                  {filters?.ngay_ct1 ? formatDate(filters.ngay_ct1) : "Tất cả"}
                  {filters?.ngay_ct2 && filters.ngay_ct2 !== filters.ngay_ct1
                    ? ` - ${formatDate(filters.ngay_ct2)}`
                    : ""}
                </span>
              </div>

              {/* Input tìm kiếm nhanh */}
              <div className="relative w-64">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  className="w-full pl-8 pr-12 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-400 focus:border-secondary-500 focus:ring-1 focus:ring-secondary-500 outline-none"
                  placeholder="Tìm số phiếu, khách hàng, diễn giải..."
                  type="text"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setIsFilterOpen(true);
                  }}
                />
                <span className="absolute inset-y-0 right-1.5 flex items-center">
                  <kbd className="text-[9px] bg-neutral-700 border-neutral-600 text-neutral-300 py-0.5 px-1">
                    F9
                  </kbd>
                </span>
              </div>

              {/* Nút làm mới */}
              <button
                onClick={() => refresh()}
                disabled={loading}
                className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white transition flex items-center justify-center"
                title="Làm mới dữ liệu từ SQL (F5)"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>

              {/* Người dùng */}
              <div className="flex items-center gap-1.5 bg-neutral-800 px-2.5 py-1 rounded border border-neutral-700">
                <User className="w-3.5 h-3.5 text-primary-300" />
                <span className="font-semibold text-neutral-200 text-xs">
                  KETOAN01
                </span>
                <span className="text-neutral-400 text-[10px]">(ĐVCS: 01)</span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main View Area */}
      <main className="flex-1 overflow-hidden relative min-h-0">
        {activeVoucher ? (
          <VoucherForm
            voucher={activeVoucher}
            onBack={navToList}
            onPrint={() => handleOpenPrint(activeVoucher.stt)}
            onViewDebt={(maDt) => handleOpenDebt(maDt)}
            onOpenPickup={() => setIsPickupOpen(true)}
          />
        ) : (
          <VoucherList
            vouchers={vouchers}
            pagination={pagination}
            filters={filters}
            loading={loading}
            selectedStt={selectedStt}
            markedStts={marked}
            detailItems={listDetail}
            detailLoading={listDetailLoading}
            debtAmount={debtAmount}
            onSelectStt={setSelectedStt}
            onToggleMark={toggleMark}
            onOpenDetail={navToDetail}
            onOpenFilter={() => setIsFilterOpen(true)}
            onOpenPrint={handleOpenPrint}
            onOpenPickup={() => setIsPickupOpen(true)}
            onOpenDebt={handleOpenDebt}
            onRefresh={refresh}
            onChangePage={handleChangePage}
          />
        )}
      </main>

      {/* ===== Bottom Shortcut Action Toolbar (ẩn khi đang mở form Sửa chứng từ) ===== */}
      {!activeVoucher && (
        <footer className="bg-neutral-900 text-neutral-200 border-t border-neutral-800 px-3 py-1 flex-shrink-0 z-20 text-[11px]">
          <div className="flex items-center justify-between flex-wrap gap-y-1 gap-x-2">
            {/* Tùy chọn in */}
            <div className="flex items-center gap-2.5 bg-neutral-800/80 px-2 py-0.5 rounded border border-neutral-700 text-[11px]">
              <span className="font-medium text-neutral-300">Tùy chọn in:</span>
              <label className="inline-flex items-center gap-1 cursor-pointer font-medium text-white">
                <input
                  defaultChecked
                  className="h-2.5 w-2.5 accent-primary-600"
                  name="print_price"
                  type="radio"
                  value="1"
                />
                <span>
                  <span className="font-mono font-bold text-primary-300">
                    1
                  </span>{" "}
                  - In giá bán
                </span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer text-neutral-300 hover:text-white">
                <input
                  className="h-2.5 w-2.5 accent-primary-600"
                  name="print_price"
                  type="radio"
                  value="0"
                />
                <span>
                  <span className="font-mono text-neutral-400">0</span> - Không
                  in giá
                </span>
              </label>
            </div>

            {/* Nhóm phím thêm/sửa/xóa/in/lọc */}
            <div className="flex items-center flex-wrap gap-1 text-[11px]">
              <button
                onClick={() => handleHotkeyBarAction("NEW")}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-primary-700 text-neutral-100 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium"
              >
                <kbd className="text-[9px] py-0 px-1">F2</kbd>
                <span>Thêm</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("EDIT")}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-primary-700 text-neutral-100 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium"
              >
                <kbd className="text-[9px] py-0 px-1">F3</kbd>
                <span>Sửa</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("DELETE")}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-danger-700 text-neutral-100 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium"
              >
                <kbd className="text-[9px] py-0 px-1">F8</kbd>
                <span>Xóa</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("PRINT")}
                className="px-2 py-0.5 bg-primary-700 hover:bg-primary-800 text-white rounded border border-primary-600 transition flex items-center gap-1 font-medium"
              >
                <kbd className="bg-primary-800 text-white border-primary-600 text-[9px] py-0 px-1">
                  F7
                </kbd>
                <span>In phiếu</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("PREVIEW")}
                className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 transition flex items-center gap-1"
              >
                <kbd className="text-[9px] py-0 px-1">Ctrl+F7</kbd>
                <span>Xem phiếu</span>
              </button>
              <button
                onClick={() => handleHotkeyBarAction("FILTER")}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 transition flex items-center gap-1"
              >
                <kbd className="text-[9px] py-0 px-1">F9</kbd>
                <span>Lọc dữ liệu</span>
              </button>
            </div>

            {/* Nhóm tiện ích và thoát */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleHotkeyBarAction("ESCAPE")}
                className="px-2.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded border border-neutral-700 transition flex items-center gap-1 font-medium"
              >
                <kbd className="text-[9px] py-0 px-1">Esc</kbd>
                <span>Quay ra</span>
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Modals */}
      <FilterDialog
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onApply={handleApplyFilter}
      />

      <PickupDialog
        isOpen={isPickupOpen}
        onClose={() => setIsPickupOpen(false)}
        onAccept={async (slips) => {
          try {
            const res = await fetch("/api/pickup/accept", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ stts: slips.map((s) => s.stt) }),
            });
            const data = await res.json();
            const n = data?.data?.total_rows ?? 0;
            showToast(
              `Đã chọn ${slips.length} phiếu xuất → ${n} dòng hàng (Giai đoạn 1: chỉ xem, không ghi).`,
            );
          } catch {
            showToast("Lỗi khi lấy dữ liệu phiếu xuất từ kho.");
          }
        }}
      />

      <DebtPanel
        isOpen={isDebtOpen}
        onClose={() => setIsDebtOpen(false)}
        maDt={debtMaDt}
      />

      <PrintPreview
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        stt={printStt}
      />
    </div>
  );
}

export default App;
