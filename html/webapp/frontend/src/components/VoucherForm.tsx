import React, { useState } from "react";
import { VoucherFullDetail } from "../types/voucher";
import { DetailGrid } from "./DetailGrid";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { formatCurrency, formatDate } from "../lib/format";
import {
  Printer,
  CreditCard,
  ArrowLeft,
  ShieldCheck,
  Lock,
} from "lucide-react";

interface VoucherFormProps {
  voucher: VoucherFullDetail;
  onBack: () => void;
  onPrint: () => void;
  onViewDebt: (maDt: string) => void;
}

export const VoucherForm: React.FC<VoucherFormProps> = ({
  voucher,
  onBack,
  onPrint,
  onViewDebt,
}) => {
  const [activeTab, setActiveTab] = useState<
    "details" | "accounting" | "delivery"
  >("details");
  const currency = voucher.ma_tte || "VND";

  return (
    <div className="flex flex-col h-full bg-slate-100 pb-12">
      {/* Top Action Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Quay lại (Esc)
          </Button>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Chứng từ:{" "}
              <span className="font-mono text-primary-700">
                {voucher.so_ct || "—"}
              </span>
            </h2>
            <Badge variant="info">Chế độ xem (Giai đoạn 1)</Badge>
            {voucher.confirmed && <Badge variant="success">Đã duyệt</Badge>}
            {voucher.posted && <Badge variant="default">Đã ghi sổ</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDebt(voucher.ma_dt)}
            className="text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            <CreditCard className="w-3.5 h-3.5 mr-1" />
            Chi tiết công nợ
          </Button>
          <Button variant="primary" size="sm" onClick={onPrint}>
            <Printer className="w-3.5 h-3.5 mr-1" />
            In phiếu (F7)
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {/* Header Information Box */}
        <div className="bg-white border border-slate-300 rounded p-3 shadow-sm space-y-3 text-xs">
          {/* Row 1: Key Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pb-2 border-b border-slate-200">
            <div>
              <span className="text-slate-500 block text-[11px]">
                Ngày chứng từ
              </span>
              <span className="font-bold font-mono text-slate-800">
                {formatDate(voucher.ngay_ct)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">
                Số chứng từ
              </span>
              <span className="font-bold font-mono text-primary-800">
                {voucher.so_ct || "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">
                Loại chứng từ
              </span>
              <span className="font-medium text-slate-800">
                {voucher.ma_ct} (Bán hàng)
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">
                Tiền tệ / Tỷ giá
              </span>
              <span className="font-mono text-slate-800">
                {voucher.ma_tte} ({voucher.ty_gia})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">
                Đơn vị cơ sở
              </span>
              <span className="font-mono text-slate-800">
                {voucher.ma_dvcs}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">
                Người lập
              </span>
              <span className="font-medium text-slate-800">
                {voucher.user_name || "KETOAN"}
              </span>
            </div>
          </div>

          {/* Row 2: Customer Details */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <span className="text-slate-500 block text-[11px]">
                Khách hàng
              </span>
              <div className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="font-mono text-primary-700 bg-primary-50 px-1 rounded border border-primary-200">
                  {voucher.ma_dt}
                </span>
                <span>{voucher.ten_dt || "—"}</span>
              </div>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">
                Người nhận / Đại diện
              </span>
              <span className="font-medium text-slate-800">
                {voucher.ong_ba || "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">
                Hạn TT (ngày)
              </span>
              <span className="font-mono text-slate-800">
                {voucher.han_tt || 0} ngày
              </span>
            </div>
          </div>

          {/* Row 3: Address & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <span className="text-slate-500 block text-[11px]">
                Địa chỉ giao hàng
              </span>
              <span className="text-slate-800 font-medium">
                {voucher.dia_chi || "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">
                Diễn giải
              </span>
              <span className="text-slate-800 italic">
                {voucher.dien_giai0 || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-slate-300 pb-1">
          <button
            onClick={() => setActiveTab("details")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t transition-colors ${
              activeTab === "details"
                ? "bg-white text-primary-700 border-t border-x border-slate-300 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Chi tiết mặt hàng ({voucher.items.length})
          </button>
          <button
            onClick={() => setActiveTab("accounting")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t transition-colors ${
              activeTab === "accounting"
                ? "bg-white text-primary-700 border-t border-x border-slate-300 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Thông tin hạch toán & Thuế
          </button>
          <button
            onClick={() => setActiveTab("delivery")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t transition-colors ${
              activeTab === "delivery"
                ? "bg-white text-primary-700 border-t border-x border-slate-300 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Vận chuyển & Hợp đồng
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "details" && (
          <DetailGrid items={voucher.items} currency={currency} />
        )}

        {activeTab === "accounting" && (
          <div className="bg-white border border-slate-300 rounded p-4 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">
                Lý do nhập xuất (Ma_Nx)
              </span>
              <span className="font-semibold text-slate-800">
                {voucher.ma_nx} - {voucher.ten_nx || "Bán hàng"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">TK Nợ phải thu (Tk2)</span>
              <span className="font-mono font-semibold text-slate-800">
                {voucher.tk2 || "1311"} - {voucher.ten_tk2 || "Phải thu KH"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">
                Biểu thuế GTGT (Ma_Thue)
              </span>
              <span className="font-mono font-semibold text-slate-800">
                {voucher.ma_thue || "V10"} ({voucher.thue_gtgt}%)
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">
                TK Thuế GTGT (Tk3 / Tk_Du3)
              </span>
              <span className="font-mono font-semibold text-slate-800">
                {voucher.tk3 || "33311"} / {voucher.tk_du3 || "1311"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">
                Loại chiết khấu (Loai_Ck)
              </span>
              <span className="font-medium text-slate-800">
                {voucher.loai_ck === "1"
                  ? "1 - Chiết khấu trước thuế"
                  : "0 - Chiết khấu sau thuế"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">
                Mã số thuế (Ma_DtGtGt)
              </span>
              <span className="font-mono text-slate-800">
                {voucher.ma_dtgtgt || "—"}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 block">
                Tên đơn vị xuất HĐ GTGT
              </span>
              <span className="font-medium text-slate-800">
                {voucher.ten_dtgtgt || voucher.ten_dt || "—"}
              </span>
            </div>
          </div>
        )}

        {activeTab === "delivery" && (
          <div className="bg-white border border-slate-300 rounded p-4 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">Mã xe vận chuyển</span>
              <span className="font-mono font-semibold text-slate-800">
                {voucher.ma_xe || "—"}{" "}
                {voucher.ten_xe ? `(${voucher.ten_xe})` : ""}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Bộ phận bán hàng</span>
              <span className="font-medium text-slate-800">
                {voucher.ma_bp || "—"}{" "}
                {voucher.ten_bp ? `(${voucher.ten_bp})` : ""}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Hợp đồng kinh tế</span>
              <span className="font-mono text-slate-800">
                {voucher.ma_hd || "—"}{" "}
                {voucher.ten_hd ? `(${voucher.ten_hd})` : ""}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">
                Chứng từ gốc kèm theo
              </span>
              <span className="font-mono text-slate-800">
                {voucher.so_ct0 || "—"} ({formatDate(voucher.ngay_ct0) || "—"})
              </span>
            </div>
          </div>
        )}

        {/* Voucher Grand Totals Banner */}
        <div className="bg-white border-2 border-primary-600/30 rounded-lg p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 select-none">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <span className="text-xs font-semibold text-slate-700 block">
                Đẳng thức thanh toán bất biến:
              </span>
              <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                TTien_Nt0 = TTien_Nt2 + TTien_Nt3
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[11px]">
                Tiền trước CK (TTien_Nt)
              </span>
              <span className="font-semibold text-slate-800 text-sm">
                {formatCurrency(voucher.ttien_nt, currency)}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">
                Chiết khấu (TTien_Nt4)
              </span>
              <span className="font-semibold text-amber-700 text-sm">
                -{formatCurrency(voucher.ttien_nt4, currency)}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">
                Tiền sau CK (TTien_Nt2)
              </span>
              <span className="font-semibold text-slate-900 text-sm">
                {formatCurrency(voucher.ttien_nt2, currency)}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">
                Thuế VAT (TTien_Nt3)
              </span>
              <span className="font-semibold text-sky-700 text-sm">
                +{formatCurrency(voucher.ttien_nt3, currency)}
              </span>
            </div>

            <div className="border-l-2 border-slate-300 pl-4">
              <span className="text-slate-700 block text-xs font-bold uppercase tracking-wide">
                Tổng thanh toán (TTien_Nt0)
              </span>
              <span className="font-bold text-lg text-emerald-700">
                {formatCurrency(voucher.ttien_nt0, currency)} {currency}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
