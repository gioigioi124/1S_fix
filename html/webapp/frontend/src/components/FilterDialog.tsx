import React, { useState, useEffect } from 'react';
import { Dialog } from './ui/Dialog';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { VoucherFilterParams } from '../types/voucher';
import { Search, RotateCcw, Calendar } from 'lucide-react';
import { getTodayDate } from '../lib/format';

interface FilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filters: VoucherFilterParams;
  onApply: (newFilters: VoucherFilterParams) => void;
}

export const FilterDialog: React.FC<FilterDialogProps> = ({
  isOpen,
  onClose,
  filters,
  onApply,
}) => {
  const [form, setForm] = useState<VoucherFilterParams>({ ...filters });

  useEffect(() => {
    setForm({ ...filters });
  }, [filters, isOpen]);

  const handleChange = (field: keyof VoucherFilterParams, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setDateShortcut = (type: 'today' | 'all') => {
    if (type === 'today') {
      const today = getTodayDate();
      setForm((prev) => ({ ...prev, ngay_ct1: today, ngay_ct2: today }));
    } else if (type === 'all') {
      setForm((prev) => ({ ...prev, ngay_ct1: '', ngay_ct2: '' }));
    }
  };

  const handleReset = () => {
    const today = getTodayDate();
    const defaultFilters: VoucherFilterParams = {
      ma_ct: 'X1',
      ngay_ct1: today,
      ngay_ct2: today,
      so_ct1: '',
      so_ct2: '',
      ma_dt: '',
      ma_kho: '',
      ma_vt: '',
      ma_tte: '',
    };
    setForm(defaultFilters);
    onApply(defaultFilters);
    onClose();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    onApply(form);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Lọc Danh Sách Chứng Từ (F3 / F9)"
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleReset} type="button">
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Đặt lại (Hôm nay)
          </Button>
          <Button variant="outline" onClick={onClose} type="button">
            Hủy bỏ (Esc)
          </Button>
          <Button variant="primary" onClick={handleSubmit} type="button">
            <Search className="w-3.5 h-3.5 mr-1" />
            Áp dụng (Enter)
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Quick Date Filters */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-primary-600" />
            Thời gian lọc nhanh:
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setDateShortcut('today')}
              className="px-2 py-1 text-xs bg-primary-50 text-primary-700 hover:bg-primary-100 rounded border border-primary-200 font-medium transition"
            >
              Hôm nay ({getTodayDate()})
            </button>
            <button
              type="button"
              onClick={() => setDateShortcut('all')}
              className="px-2 py-1 text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 rounded border border-slate-300 font-medium transition"
            >
              Tất cả các ngày
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Loại CT (Ma_Ct)</label>
            <select
              className="w-full text-xs border border-slate-300 rounded px-2 py-2 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
              value={form.ma_ct || 'X1'}
              onChange={(e) => handleChange('ma_ct', e.target.value)}
            >
              <option value="X1">X1 - Xuất bán</option>
              <option value="BH">BH - Bán hàng</option>
              <option value="N5">N5 - Nhập lại</option>
              <option value="ALL">Tất cả loại</option>
            </select>
          </div>
          <Input
            label="Từ ngày (Ngay_Ct1)"
            type="date"
            value={form.ngay_ct1 || ''}
            onChange={(e) => handleChange('ngay_ct1', e.target.value)}
          />
          <Input
            label="Đến ngày (Ngay_Ct2)"
            type="date"
            value={form.ngay_ct2 || ''}
            onChange={(e) => handleChange('ngay_ct2', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Từ số chứng từ (So_Ct1)"
            placeholder="VD: HD0001"
            value={form.so_ct1 || ''}
            onChange={(e) => handleChange('so_ct1', e.target.value)}
          />
          <Input
            label="Đến số chứng từ (So_Ct2)"
            placeholder="VD: HD9999"
            value={form.so_ct2 || ''}
            onChange={(e) => handleChange('so_ct2', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Mã khách hàng (Ma_Dt)"
            placeholder="VD: KH0089"
            value={form.ma_dt || ''}
            onChange={(e) => handleChange('ma_dt', e.target.value)}
          />
          <Input
            label="Mã kho xuất (Ma_Kho)"
            placeholder="VD: KHO01"
            value={form.ma_kho || ''}
            onChange={(e) => handleChange('ma_kho', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Mã vật tư trong chi tiết (Ma_Vt)"
            placeholder="VD: MUT_D40"
            value={form.ma_vt || ''}
            onChange={(e) => handleChange('ma_vt', e.target.value)}
          />
          <Input
            label="Loại tiền tệ (Ma_Tte)"
            placeholder="VND / USD"
            value={form.ma_tte || ''}
            onChange={(e) => handleChange('ma_tte', e.target.value)}
          />
        </div>
      </form>
    </Dialog>
  );
};
