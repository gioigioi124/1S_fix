import React from 'react';
import { VoucherDetail } from '../types/voucher';
import { formatCurrency, formatQuantity } from '../lib/format';

interface DetailGridProps {
  items: VoucherDetail[];
  currency?: string;
}

export const DetailGrid: React.FC<DetailGridProps> = ({ items, currency = 'VND' }) => {
  const totalSoTam = items.reduce((sum, it) => sum + (it.so_tam || 0), 0);
  const totalSoLuong9 = items.reduce((sum, it) => sum + (it.so_luong9 || 0), 0);
  const totalTienNt9 = items.reduce((sum, it) => sum + (it.tien_nt9 || 0), 0);
  const totalTienNt4 = items.reduce((sum, it) => sum + (it.tien_nt4 || 0), 0);
  const totalTienNt2 = items.reduce((sum, it) => sum + (it.tien_nt2 || 0), 0);

  return (
    <div className="w-full border border-slate-300 rounded overflow-hidden bg-white shadow-sm flex flex-col">
      <div className="overflow-x-auto max-h-[360px]">
        <table className="w-full border-collapse text-left select-text">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="vfp-header w-8 text-center">STT</th>
              <th className="vfp-header w-24">Mã VT</th>
              <th className="vfp-header min-w-[180px]">Tên vật tư hàng hóa</th>
              <th className="vfp-header w-14 text-center">ĐVT</th>
              <th className="vfp-header w-14 text-center">ĐVT Bán</th>
              <th className="vfp-header w-16 text-right">Số tấm</th>
              <th className="vfp-header w-14 text-right">Hệ số</th>
              <th className="vfp-header w-20 text-right">SL bán</th>
              <th className="vfp-header w-20 text-right">Số lượng</th>
              <th className="vfp-header w-24 text-right">Đơn giá</th>
              <th className="vfp-header w-28 text-right">Thành tiền</th>
              <th className="vfp-header w-14 text-right">CK (%)</th>
              <th className="vfp-header w-24 text-right">Tiền CK</th>
              <th className="vfp-header w-28 text-right">Thành tiền sau CK</th>
              <th className="vfp-header w-16 text-center">TK Có</th>
              <th className="vfp-header w-16 text-center">Kho</th>
              <th className="vfp-header w-10 text-center">TT</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={17} className="px-4 py-8 text-center text-slate-400 italic text-xs">
                  Không có dòng mặt hàng nào
                </td>
              </tr>
            ) : (
              items.map((it, idx) => (
                <tr
                  key={it.stt0 || idx}
                  className="hover:bg-amber-50/60 transition-colors border-b border-slate-200"
                >
                  <td className="vfp-cell text-center text-slate-400 font-mono">{idx + 1}</td>
                  <td className="vfp-cell font-mono font-medium text-slate-700">{it.ma_vt}</td>
                  <td className="vfp-cell font-medium text-slate-800">{it.ten_vt || '—'}</td>
                  <td className="vfp-cell text-center text-slate-600">{it.dvt || '—'}</td>
                  <td className="vfp-cell text-center text-slate-600">{it.dvt_ban || it.dvt || '—'}</td>
                  <td className="vfp-cell text-right text-slate-700">{formatQuantity(it.so_tam)}</td>
                  <td className="vfp-cell text-right text-slate-700">{formatQuantity(it.he_so8)}</td>
                  <td className="vfp-cell text-right font-medium text-slate-800">
                    {formatQuantity(it.so_luong8)}
                  </td>
                  <td className="vfp-cell text-right font-semibold text-primary-700">
                    {formatQuantity(it.so_luong9)}
                  </td>
                  <td className="vfp-cell text-right font-mono text-slate-800">
                    {formatCurrency(it.gia_nt9, currency)}
                  </td>
                  <td className="vfp-cell text-right font-mono text-slate-800">
                    {formatCurrency(it.tien_nt9, currency)}
                  </td>
                  <td className="vfp-cell text-right text-amber-700 font-medium">
                    {it.chiet_khau ? `${it.chiet_khau}%` : '0%'}
                  </td>
                  <td className="vfp-cell text-right font-mono text-amber-700">
                    {formatCurrency(it.tien_nt4, currency)}
                  </td>
                  <td className="vfp-cell text-right font-mono font-semibold text-emerald-700">
                    {formatCurrency(it.tien_nt2, currency)}
                  </td>
                  <td className="vfp-cell text-center font-mono text-slate-600">{it.tk_du2 || '5111'}</td>
                  <td className="vfp-cell text-center font-mono text-slate-600">{it.ma_kho || '—'}</td>
                  <td className="vfp-cell text-center text-slate-500">{it.gia_tb_tt || 'K'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="bg-slate-100 border-t border-slate-300 px-3 py-2 flex flex-wrap items-center justify-between text-xs font-semibold text-slate-700 gap-4 select-none">
        <div className="flex items-center gap-4">
          <span>Tổng số dòng: <strong className="text-slate-900">{items.length}</strong></span>
          <span>Số tấm: <strong className="text-slate-900">{formatQuantity(totalSoTam)}</strong></span>
          <span>Số lượng xuất: <strong className="text-primary-700">{formatQuantity(totalSoLuong9)}</strong></span>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <span>Tiền hàng: <strong className="text-slate-900">{formatCurrency(totalTienNt9, currency)}</strong></span>
          <span>Chiết khấu: <strong className="text-amber-700">-{formatCurrency(totalTienNt4, currency)}</strong></span>
          <span>Sau CK: <strong className="text-emerald-700">{formatCurrency(totalTienNt2, currency)}</strong></span>
        </div>
      </div>
    </div>
  );
};
