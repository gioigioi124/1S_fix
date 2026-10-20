import React, { useState, useEffect } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { PickupSlip, PickupItem } from '../types/pickup';
import { formatQuantity, formatDate } from '../lib/format';
import { Warehouse, CheckSquare, Square, RefreshCw } from 'lucide-react';

interface PickupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  maDt?: string;
  onAccept: (selectedSlips: PickupSlip[], items: PickupItem[]) => void;
}

export const PickupDialog: React.FC<PickupDialogProps> = ({
  isOpen,
  onClose,
  maDt,
  onAccept,
}) => {
  const [slips, setSlips] = useState<PickupSlip[]>([]);
  const [selectedStts, setSelectedStts] = useState<Set<string>>(new Set());
  const [activeStt, setActiveStt] = useState<string | null>(null);
  const [activeItems, setActiveItems] = useState<PickupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch slips
  const loadSlips = async () => {
    setLoading(true);
    try {
      const url = maDt ? `/api/pickup/list?ma_dt=${encodeURIComponent(maDt)}` : '/api/pickup/list';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.data?.items) {
        setSlips(data.data.items);
        if (data.data.items.length > 0) {
          setActiveStt(data.data.items[0].stt);
        }
      }
    } catch (e) {
      console.error('Error fetching pickup slips', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSlips();
    }
  }, [isOpen, maDt]);

  // Fetch items when active slip changes
  useEffect(() => {
    if (!activeStt) {
      setActiveItems([]);
      return;
    }
    const fetchDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/pickup/detail/${encodeURIComponent(activeStt)}`);
        const data = await res.json();
        if (data.success && data.data?.items) {
          setActiveItems(data.data.items);
        }
      } catch (e) {
        console.error('Error fetching pickup detail', e);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [activeStt]);

  const toggleSelect = (stt: string) => {
    setSelectedStts((prev) => {
      const next = new Set(prev);
      if (next.has(stt)) {
        next.delete(stt);
      } else {
        next.add(stt);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedStts(new Set(slips.map((s) => s.stt)));
  };

  const deselectAll = () => {
    setSelectedStts(new Set());
  };

  const handleAccept = () => {
    const selected = slips.filter((s) => selectedStts.has(s.stt));
    onAccept(selected, activeItems);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Chọn Phiếu Xuất Từ Kho (ctbhch - KH_2014)"
      width="max-w-5xl"
      footer={
        <>
          <div className="flex-1 text-xs text-slate-500 font-mono">
            Đã chọn: <strong className="text-primary-700">{selectedStts.size}</strong> / {slips.length} phiếu
          </div>
          <Button variant="secondary" size="sm" onClick={selectAll} type="button">
            Chọn tất cả (Ctrl+A)
          </Button>
          <Button variant="secondary" size="sm" onClick={deselectAll} type="button">
            Bỏ chọn (Ctrl+U)
          </Button>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Hủy bỏ (Esc)
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAccept}
            disabled={selectedStts.size === 0}
            type="button"
          >
            Chấp nhận (Enter)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Master Slips List */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 text-primary-600" />
              Danh sách phiếu xuất kho chưa lập hóa đơn (Grid1 - K_DsPx)
            </h4>
            <Button variant="ghost" size="sm" onClick={loadSlips} disabled={loading}>
              <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
          </div>

          <div className="border border-slate-300 rounded overflow-hidden max-h-[200px] overflow-y-auto bg-white">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-200 z-10">
                <tr>
                  <th className="vfp-header w-10 text-center">Chọn</th>
                  <th className="vfp-header w-24">Số PX</th>
                  <th className="vfp-header w-24">Ngày xuất</th>
                  <th className="vfp-header w-24">Mã KH</th>
                  <th className="vfp-header min-w-[200px]">Tên khách hàng</th>
                  <th className="vfp-header w-20">Mã xe</th>
                  <th className="vfp-header w-16 text-right">Số dòng</th>
                  <th className="vfp-header w-20 text-right">Số tấm</th>
                  <th className="vfp-header w-20 text-right">SL bán</th>
                </tr>
              </thead>
              <tbody>
                {slips.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-400 italic">
                      {loading ? 'Đang tải dữ liệu từ CSDL Kho...' : 'Không có phiếu xuất nào sẵn sàng'}
                    </td>
                  </tr>
                ) : (
                  slips.map((s) => {
                    const isChecked = selectedStts.has(s.stt);
                    const isActive = activeStt === s.stt;
                    return (
                      <tr
                        key={s.stt}
                        onClick={() => setActiveStt(s.stt)}
                        className={`cursor-pointer transition-colors border-b border-slate-200 ${
                          isActive ? 'bg-primary-50 font-medium' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td
                          className="vfp-cell text-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(s.stt);
                          }}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-primary-600 mx-auto" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 mx-auto" />
                          )}
                        </td>
                        <td className="vfp-cell font-mono font-bold text-primary-700">{s.so_ct || s.stt}</td>
                        <td className="vfp-cell font-mono">{formatDate(s.ngay_ct)}</td>
                        <td className="vfp-cell font-mono">{s.ma_dt}</td>
                        <td className="vfp-cell">{s.ten_dt || '—'}</td>
                        <td className="vfp-cell font-mono">{s.ma_xe || '—'}</td>
                        <td className="vfp-cell text-right font-mono">{s.total_items}</td>
                        <td className="vfp-cell text-right font-mono">{formatQuantity(s.total_so_tam)}</td>
                        <td className="vfp-cell text-right font-mono font-semibold text-primary-700">
                          {formatQuantity(s.total_so_luong9)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Items of Active Slip */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
            <span>Chi tiết phiếu xuất đang chọn (Grid2 - K_CtPx)</span>
            {activeStt && (
              <Badge variant="info">Phiếu: {activeStt}</Badge>
            )}
          </h4>

          <div className="border border-slate-300 rounded overflow-hidden max-h-[180px] overflow-y-auto bg-white">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-200 z-10">
                <tr>
                  <th className="vfp-header w-8 text-center">STT</th>
                  <th className="vfp-header w-24">Mã VT</th>
                  <th className="vfp-header min-w-[200px]">Tên vật tư</th>
                  <th className="vfp-header w-16 text-center">ĐVT</th>
                  <th className="vfp-header w-16 text-center">Kho</th>
                  <th className="vfp-header w-16 text-right">Số tấm</th>
                  <th className="vfp-header w-16 text-right">Hệ số</th>
                  <th className="vfp-header w-20 text-right">SL bán</th>
                  <th className="vfp-header w-20 text-right">SL xuất</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-400 italic">
                      {loadingDetail ? 'Đang nạp chi tiết...' : 'Chọn một phiếu ở trên để xem chi tiết'}
                    </td>
                  </tr>
                ) : (
                  activeItems.map((item, idx) => (
                    <tr key={item.stt0 || idx} className="hover:bg-slate-50 border-b border-slate-200">
                      <td className="vfp-cell text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="vfp-cell font-mono font-medium text-slate-700">{item.ma_vt}</td>
                      <td className="vfp-cell font-medium text-slate-800">{item.ten_vt || '—'}</td>
                      <td className="vfp-cell text-center text-slate-600">{item.dvt || '—'}</td>
                      <td className="vfp-cell text-center font-mono text-slate-600">{item.ma_kho || '—'}</td>
                      <td className="vfp-cell text-right font-mono">{formatQuantity(item.so_tam)}</td>
                      <td className="vfp-cell text-right font-mono">{formatQuantity(item.he_so8)}</td>
                      <td className="vfp-cell text-right font-mono font-medium text-slate-800">
                        {formatQuantity(item.so_luong8)}
                      </td>
                      <td className="vfp-cell text-right font-mono font-semibold text-primary-700">
                        {formatQuantity(item.so_luong9)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
