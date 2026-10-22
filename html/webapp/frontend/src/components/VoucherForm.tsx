import React from "react";
import { VoucherFullDetail } from "../types/voucher";
import { DetailGrid } from "./DetailGrid";
import { formatCurrency, formatDate, formatQuantity } from "../lib/format";
import {
  Printer,
  CreditCard,
  X,
  FileText,
  SlidersHorizontal,
  Table,
  Trash2,
  Calculator,
  Check,
  Ban,
  Info,
} from "lucide-react";

interface VoucherFormProps {
  voucher: VoucherFullDetail;
  onBack: () => void;
  onPrint: () => void;
  onViewDebt: (maDt: string) => void;
  onOpenPickup: () => void;
}

/**
 * Màn hình Thêm mới / Sửa chứng từ (ctbhd) — 100% READ-ONLY ở Giai đoạn 1.
 * Giao diện dày đặc theo mẫu `ctbhd.html`.
 */
export const VoucherForm: React.FC<VoucherFormProps> = ({
  voucher,
  onBack,
  onPrint,
  onViewDebt,
  onOpenPickup,
}) => {
  const currency = voucher.ma_tte || "VND";
  const totalQty = voucher.items.reduce((s, it) => s + (it.so_luong9 || 0), 0);

  const readonlyField =
    "erp-input w-full font-mono text-neutral-800 bg-neutral-100 border-neutral-200 cursor-default";

  return (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden">
      {/* ===== Window Header (navy) ===== */}
      <header className="bg-gradient-to-r from-primary-800 via-primary-700 to-primary-800 text-white px-4 py-2 flex items-center justify-between shadow-md shrink-0 border-b border-primary-900">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded bg-white/15 text-primary-100 border border-white/20">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide uppercase text-white">
              Sửa Chứng Từ
            </span>
            <span className="text-primary-200 text-xs font-normal">
              / Bán hàng công nợ
            </span>
            <span className="ml-1 text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded border border-white/20">
              GĐ1: READ-ONLY
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-primary-200">Người lập:</span>
            <span className="font-semibold text-white bg-primary-900/60 px-2 py-0.5 rounded border border-white/20">
              {voucher.user_name || "KETOAN"}
            </span>
          </div>
          <div className="flex items-center gap-1 pl-2 border-l border-white/20">
            <button
              className="p-1 px-2 text-primary-200 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="In phiếu (F7)"
              onClick={onPrint}
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 px-2 text-primary-200 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Chi tiết công nợ"
              onClick={() => onViewDebt(voucher.ma_dt)}
            >
              <CreditCard className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 px-2 text-rose-200 hover:text-white hover:bg-danger-600 rounded transition-colors ml-1"
              title="Đóng (Esc)"
              onClick={onBack}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ===== Master Information Form ===== */}
      <section
        className="bg-neutral-50/90 border-b border-neutral-200 px-3 py-1.5 shrink-0"
        data-purpose="master-form"
      >
        <div className="grid grid-cols-12 gap-x-2.5 gap-y-1.5 max-w-[1920px] mx-auto">
          {/* Left & Center: Transaction & Customer (col 1-10) */}
          <div className="col-span-12 xl:col-span-10 grid grid-cols-12 gap-x-2 gap-y-1">
            {/* Row 1: Dates, Voucher No & Credit Guard */}
            <div className="col-span-12 flex flex-wrap items-center gap-x-3 gap-y-1 pb-1 border-b border-neutral-200/80">
              <div className="flex items-center gap-1.5">
                <label className="erp-label text-neutral-700 font-bold">
                  Ngày hạch toán:
                </label>
                <input
                  className={readonlyField + " w-28 text-xs py-0.5"}
                  value={formatDate(voucher.ngay_ct)}
                  readOnly
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="erp-label text-neutral-700 font-bold">
                  Số phiếu:
                </label>
                <input
                  className="erp-input w-24 font-mono font-bold text-primary-700 bg-white border-primary-300 text-center uppercase tracking-wide text-xs py-0.5 cursor-default"
                  value={voucher.so_ct || "—"}
                  readOnly
                />
              </div>

              {/* Financial Credit Health Monitor */}
              <div className="flex items-center gap-2 ml-auto bg-white py-0.5 px-2.5 rounded border border-neutral-200 shadow-sm text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-neutral-500 font-medium text-[11px]">
                    Hạn TT:
                  </span>
                  <span className="font-mono font-semibold text-neutral-800 text-[11px]">
                    {voucher.han_tt || 0} ngày
                  </span>
                </div>
                <span className="text-neutral-300">|</span>
                <div className="flex items-center gap-1">
                  <span className="text-neutral-500 font-medium text-[11px]">
                    Tỷ giá:
                  </span>
                  <span className="font-mono font-bold text-tertiary-600 text-[11px]">
                    {voucher.ty_gia}
                  </span>
                </div>
                <span className="text-neutral-300">|</span>
                <div className="flex items-center gap-1">
                  <span className="text-neutral-500 font-medium text-[11px]">
                    Ma_Ct:
                  </span>
                  <span className="inline-flex items-center px-1 rounded text-[10px] font-bold bg-success-50 text-success-700 border border-success-200">
                    {voucher.ma_ct}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 2: Customer / Counterparty */}
            <div className="col-span-12 flex items-center gap-2">
              <label className="erp-label w-20 shrink-0">Đối tượng:</label>
              <div className="w-28 shrink-0">
                <input
                  className="erp-input w-full font-mono font-bold text-neutral-700 bg-tertiary-50/70 border-tertiary-300 text-xs py-0.5 cursor-default"
                  value={voucher.ma_dt}
                  readOnly
                />
              </div>
              <div className="flex-1">
                <input
                  className="erp-input w-full font-semibold text-neutral-800 bg-neutral-100 border-neutral-200 text-xs py-0.5 cursor-default"
                  value={voucher.ten_dt || "—"}
                  readOnly
                />
              </div>
            </div>

            {/* Row 3: Contact & Address */}
            <div className="col-span-6 flex items-center gap-2">
              <label className="erp-label w-20 shrink-0">Ông/Bà (LH):</label>
              <input
                className="erp-input w-full font-medium text-neutral-700 bg-white text-xs py-0.5 cursor-default"
                value={voucher.ong_ba || "—"}
                readOnly
              />
            </div>
            <div className="col-span-6 flex items-center gap-2">
              <label className="erp-label w-14 shrink-0 text-right">
                Địa chỉ:
              </label>
              <input
                className="erp-input w-full text-neutral-600 bg-neutral-100/70 text-xs py-0.5 cursor-default"
                value={voucher.dia_chi || "—"}
                readOnly
              />
            </div>

            {/* Row 4: Reason / Description */}
            <div className="col-span-12 flex items-center gap-2">
              <label className="erp-label w-20 shrink-0">Diễn giải:</label>
              <input
                className="erp-input w-full font-medium text-neutral-800 bg-white text-xs py-0.5 cursor-default"
                value={voucher.dien_giai0 || "—"}
                readOnly
              />
            </div>

            {/* Row 5: Department & Transportation */}
            <div className="col-span-7 flex items-center gap-2">
              <label className="erp-label w-20 shrink-0 text-neutral-500">
                Bộ phận:
              </label>
              <div className="w-16 shrink-0">
                <input
                  className="erp-input w-full font-mono text-center text-xs py-0.5 bg-neutral-100 text-neutral-500 border-neutral-200 cursor-default"
                  value={voucher.ma_bp || "—"}
                  readOnly
                />
              </div>
              <input
                className="erp-input w-full text-xs py-0.5 bg-neutral-100 text-neutral-500 border-neutral-200 cursor-default"
                value={voucher.ten_bp || "—"}
                readOnly
              />
            </div>
            <div className="col-span-5 flex items-center gap-2">
              <label className="erp-label shrink-0 text-right">Xe:</label>
              <input
                className="erp-input w-full text-neutral-700 bg-white text-xs py-0.5 cursor-default"
                value={
                  voucher.ma_xe
                    ? `${voucher.ma_xe}${voucher.ten_xe ? " - " + voucher.ten_xe : ""}`
                    : "—"
                }
                readOnly
              />
              <button
                type="button"
                onClick={onOpenPickup}
                className="inline-flex items-center px-2 py-0.5 rounded bg-secondary-50 hover:bg-secondary-100 text-secondary-700 border border-secondary-300 shadow-sm font-medium text-xs whitespace-nowrap shrink-0 transition-colors"
                title="Chọn phiếu xuất từ kho (ctbhch)"
              >
                <FileText className="w-3 h-3 mr-1.5 text-secondary-600" />
                Chọn phiếu xuất
              </button>
            </div>
          </div>

          {/* Right: Accounting Posting Parameters (col 11-12) */}
          <div className="col-span-12 xl:col-span-2 bg-white p-1.5 rounded border border-neutral-200 shadow-sm flex flex-col gap-1.5 self-start">
            <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider pb-0.5 border-b border-neutral-100 flex items-center justify-between">
              <span>Định khoản</span>
              <SlidersHorizontal className="w-3 h-3 text-neutral-400" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-1.5">
                <label className="erp-label shrink-0 text-neutral-600">
                  Mã NX:
                </label>
                <input
                  className="erp-input w-16 text-center font-mono font-bold bg-tertiary-50/70 border-tertiary-300 text-xs py-0.5 cursor-default"
                  value={voucher.ma_nx || "131"}
                  readOnly
                />
              </div>
              <div className="flex items-center justify-between gap-1.5">
                <label className="erp-label shrink-0 text-neutral-600">
                  TK Nợ:
                </label>
                <input
                  className="erp-input w-16 text-center font-mono font-bold bg-tertiary-50/70 border-tertiary-300 text-primary-900 text-xs py-0.5 cursor-default"
                  value={voucher.tk2 || "1311"}
                  readOnly
                />
              </div>
              <div className="flex items-center justify-between gap-1.5">
                <label className="erp-label shrink-0 text-neutral-600">
                  TK VAT:
                </label>
                <input
                  className="erp-input w-16 text-center font-mono font-bold bg-tertiary-50/70 border-tertiary-300 text-xs py-0.5 cursor-default"
                  value={voucher.tk3 || "33311"}
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Grid Toolbar ===== */}
      <div
        className="bg-neutral-100 px-4 py-1.5 border-b border-neutral-200 flex items-center justify-between shrink-0"
        data-purpose="grid-actions"
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs uppercase tracking-wide text-neutral-700 flex items-center gap-1.5">
            <Table className="w-3.5 h-3.5 text-primary-600" /> Chi tiết hàng hóa
          </span>
          <span className="text-neutral-400">|</span>
          <span className="text-neutral-500 text-[11px]">
            Đang ghi nhận:{" "}
            <b className="text-neutral-800">{voucher.items.length} dòng</b>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2 px-2 py-1 rounded bg-white border border-neutral-300 shadow-sm text-xs">
            <span className="text-[11px] text-neutral-500 font-medium">
              Tổng SL:
            </span>
            <span className="font-mono font-bold text-neutral-800">
              {formatQuantity(totalQty)}
            </span>
          </div>
          <button
            className="inline-flex items-center px-2 py-1 rounded bg-white border border-neutral-300 text-neutral-700 shadow-sm font-medium hover:border-danger-400 hover:text-danger-600 transition-colors opacity-60"
            title="Xóa dòng (khóa ở GĐ1)"
          >
            <Trash2 className="w-3.5 h-3.5 text-danger-500 mr-1.5" /> Xóa dòng
            <kbd className="ml-1.5">F8</kbd>
          </button>
          <button
            className="inline-flex items-center px-2 py-1 rounded bg-white border border-neutral-300 text-neutral-700 shadow-sm font-medium hover:border-primary-400 transition-colors opacity-60"
            title="Tính tiền (khóa ở GĐ1)"
          >
            <Calculator className="w-3.5 h-3.5 text-primary-600 mr-1.5" /> Tính
            tiền
            <kbd className="ml-1.5">F5</kbd>
          </button>
        </div>
      </div>

      {/* ===== Main Data Grid ===== */}
      <div
        className="flex-1 overflow-hidden bg-white relative"
        data-purpose="ledger-table-container"
      >
        <DetailGrid items={voucher.items} currency={currency} variant="form" />
      </div>

      {/* ===== Action Footer Bar ===== */}
      <footer
        className="bg-white border-t border-neutral-300 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0"
        data-purpose="footer-controls"
      >
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center px-4 py-1.5 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded shadow-sm transition-all opacity-80"
            type="button"
            title="Chấp nhận (khóa ở GĐ1)"
          >
            <Check className="w-4 h-4 mr-2" />
            Chấp nhận
            <kbd className="ml-2 bg-primary-900/40 text-primary-100 border-primary-600">
              Ctrl + Enter
            </kbd>
          </button>
          <button
            className="inline-flex items-center px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded border border-neutral-300 transition-all"
            type="button"
            onClick={onBack}
          >
            <Ban className="w-4 h-4 text-neutral-500 mr-2" />
            Hủy bỏ
            <kbd className="ml-2">Esc</kbd>
          </button>
          <div className="h-5 w-px bg-neutral-300 mx-1"></div>
          <button
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200 transition-colors"
            title="Nhật ký chứng từ & Lịch sử chỉnh sửa"
            type="button"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-neutral-600">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-tight">
                Hạn TT:
              </span>
              <div className="flex items-center gap-1 bg-white border border-primary-200 rounded px-2.5 py-1 shadow-sm">
                <span className="font-mono font-bold text-primary-900 text-xs">
                  {voucher.han_tt || 0}
                </span>
                <span className="text-[11px] font-semibold text-neutral-500">
                  ngày
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-tight">
                Tiền CK:
              </span>
              <div className="flex items-center gap-1 bg-white border border-primary-200 rounded px-2.5 py-1 shadow-sm">
                <span className="font-mono font-bold text-primary-900 text-xs">
                  {formatCurrency(voucher.ttien_nt4, currency)}
                </span>
                <span className="text-[11px] font-bold text-primary-700">
                  ₫
                </span>
              </div>
            </div>
            <div className="h-5 w-px bg-neutral-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase font-bold text-neutral-600 tracking-wide">
                Tổng tiền thanh toán:
              </span>
              <div className="flex items-center gap-1 bg-primary-50 border border-primary-300 rounded px-3 py-1 shadow-sm">
                <span className="font-mono font-bold text-primary-900 tracking-tight text-sm">
                  {formatCurrency(voucher.ttien_nt0, currency)}
                </span>
                <span className="text-xs font-bold text-primary-700">₫</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
