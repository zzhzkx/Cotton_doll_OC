import { useState, useRef, useEffect } from 'react';
import './DatePicker.css';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export default function DatePicker({ value, onChange, placeholder = '选择日期' }) {
  const [isOpen, setIsOpen] = useState(false);
  // viewMode: 'days' | 'months' | 'years'
  const [viewMode, setViewMode] = useState('days');
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const d = new Date(value);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  });
  // 年份选择面板的起始年（每页12年）
  const [yearPageStart, setYearPageStart] = useState(() => {
    const y = (value ? new Date(value).getFullYear() : new Date().getFullYear());
    return Math.floor(y / 12) * 12;
  });

  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
        setViewMode('days');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // --- 日历视图 ---
  const firstDay = new Date(year, month, 1).getDay();
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays = [];
  for (let i = adjustedFirstDay - 1; i >= 0; i--) {
    calendarDays.push({ day: daysInPrevMonth - i, currentMonth: false, date: new Date(year, month - 1, daysInPrevMonth - i) });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
  }
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
  }

  const handleSelect = (dayObj) => {
    if (!dayObj.currentMonth) return;
    const yyyy = dayObj.date.getFullYear();
    const mm = String(dayObj.date.getMonth() + 1).padStart(2, '0');
    const dd = String(dayObj.date.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
    setViewMode('days');
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  };

  const isSelected = (date) => {
    if (!value) return false;
    const selected = new Date(value);
    return date.getFullYear() === selected.getFullYear() && date.getMonth() === selected.getMonth() && date.getDate() === selected.getDate();
  };

  // --- 月份选择 ---
  const handleMonthSelect = (m) => {
    setViewDate(new Date(year, m, 1));
    setViewMode('days');
  };

  // --- 年份选择 ---
  const handleYearSelect = (y) => {
    setViewDate(new Date(y, month, 1));
    setViewMode('months');
  };

  const yearList = [];
  for (let i = yearPageStart; i < yearPageStart + 12; i++) {
    yearList.push(i);
  }

  const displayText = value || placeholder;

  return (
    <div className="date-picker" ref={ref}>
      <div
        className={`date-picker-input ${isOpen ? 'active' : ''} ${!value ? 'placeholder' : ''}`}
        onClick={() => { setIsOpen(!isOpen); setViewMode('days'); }}
      >
        <svg className="date-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{displayText}</span>
      </div>

      {isOpen && (
        <div className="date-picker-dropdown fade-in-up">

          {/* === 年份选择面板 === */}
          {viewMode === 'years' && (
            <>
              <div className="picker-header">
                <button type="button" className="nav-btn" onClick={() => setYearPageStart(yearPageStart - 12)}>&laquo;</button>
                <span className="picker-title clickable">{yearPageStart} - {yearPageStart + 11}</span>
                <button type="button" className="nav-btn" onClick={() => setYearPageStart(yearPageStart + 12)}>&raquo;</button>
              </div>
              <div className="picker-grid">
                {yearList.map(y => (
                  <button
                    key={y}
                    type="button"
                    className={`grid-btn ${y === year ? 'selected' : ''} ${y === new Date().getFullYear() ? 'today' : ''}`}
                    onClick={() => handleYearSelect(y)}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* === 月份选择面板 === */}
          {viewMode === 'months' && (
            <>
              <div className="picker-header">
                <button type="button" className="nav-btn" onClick={() => setViewDate(new Date(year - 1, month, 1))}>&laquo;</button>
                <span className="picker-title clickable" onClick={() => setViewMode('years')}>{year}年</span>
                <button type="button" className="nav-btn" onClick={() => setViewDate(new Date(year + 1, month, 1))}>&raquo;</button>
              </div>
              <div className="picker-grid">
                {MONTHS.map((m, idx) => (
                  <button
                    key={m}
                    type="button"
                    className={`grid-btn ${idx === month ? 'selected' : ''}`}
                    onClick={() => handleMonthSelect(idx)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* === 日期选择面板 === */}
          {viewMode === 'days' && (
            <>
              <div className="picker-header">
                <button type="button" className="nav-btn" onClick={() => setViewDate(new Date(year - 1, month, 1))}>&laquo;</button>
                <button type="button" className="nav-btn" onClick={() => setViewDate(new Date(year, month - 1, 1))}>&lsaquo;</button>
                <span className="picker-title">
                  <span className="clickable" onClick={() => setViewMode('years')}>{year}年</span>
                  {' '}
                  <span className="clickable" onClick={() => setViewMode('months')}>{month + 1}月</span>
                </span>
                <button type="button" className="nav-btn" onClick={() => setViewDate(new Date(year, month + 1, 1))}>&rsaquo;</button>
                <button type="button" className="nav-btn" onClick={() => setViewDate(new Date(year + 1, month, 1))}>&raquo;</button>
              </div>

              <div className="picker-weekdays">
                {WEEKDAYS.map(d => <div key={d} className="weekday">{d}</div>)}
              </div>

              <div className="picker-days">
                {calendarDays.map((dayObj, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={[
                      'day-btn',
                      !dayObj.currentMonth ? 'other-month' : '',
                      isToday(dayObj.date) ? 'today' : '',
                      isSelected(dayObj.date) ? 'selected' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => handleSelect(dayObj)}
                    disabled={!dayObj.currentMonth}
                  >
                    {dayObj.day}
                  </button>
                ))}
              </div>

              {value && (
                <button type="button" className="clear-btn" onClick={() => { onChange(''); setIsOpen(false); }}>
                  清除日期
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
