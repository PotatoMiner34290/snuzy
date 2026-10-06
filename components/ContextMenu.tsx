'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface CtxSlider {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  accent?: string;
}

export interface CtxItem {
  label?: React.ReactNode;
  hint?: string;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
  header?: boolean;
  separator?: boolean;
  submenu?: CtxItem[];
  slider?: CtxSlider;
  custom?: React.ReactNode;
  onClick?: () => void;
}

interface MenuProps {
  x: number;
  y: number;
  items: CtxItem[];
  onClose: () => void;
}

const PANEL: React.CSSProperties = {
  position: 'fixed',
  zIndex: 10000,
  minWidth: 230,
  maxWidth: 300,
  background: '#171c29',
  border: '1px solid #3b475d',
  borderRadius: 8,
  boxShadow: '0 12px 40px #000c',
  padding: 4,
  fontSize: 12,
  color: '#dbe2e9',
  userSelect: 'none',
};

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  borderRadius: 5,
  padding: '7px 10px',
  cursor: 'pointer',
  color: 'inherit',
  fontSize: 12,
};

function MenuLevel({ items, onClose, flip }: { items: CtxItem[]; onClose: () => void; flip: boolean }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <>
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={i} style={{ height: 1, background: '#2c3547', margin: '4px 6px' }} />;
        }
        if (item.header) {
          return (
            <div key={i} style={{ padding: '6px 10px 4px', fontSize: 10, fontWeight: 800, color: '#00e5ff', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.label}
            </div>
          );
        }
        if (item.custom) {
          return <div key={i}>{item.custom}</div>;
        }
        if (item.slider) {
          const s = item.slider;
          return (
            <div key={i} style={{ ...ROW, cursor: 'default' }}>
              <span style={{ flexShrink: 0, color: '#90a4ae', fontWeight: 700, fontSize: 11 }}>{item.label}</span>
              <input
                type="range" min={s.min} max={s.max} value={s.value}
                onChange={e => s.onChange(Number(e.target.value))}
                onClick={e => e.stopPropagation()}
                style={{ flex: 1, accentColor: s.accent || '#00e5ff', cursor: 'pointer', minWidth: 0 }}
              />
              <span style={{ flexShrink: 0, color: '#cfd8dc', fontWeight: 700, minWidth: 30, textAlign: 'right' }}>{s.value}</span>
            </div>
          );
        }
        const hasSub = !!item.submenu?.length;
        const open = openIdx === i;
        return (
          <div key={i} style={{ position: 'relative' }}>
            <button
              className="ctx-row"
              style={{
                ...ROW,
                color: item.danger ? '#ff8a80' : 'inherit',
                background: open ? '#283247' : 'transparent',
                cursor: item.disabled ? 'default' : 'pointer',
                opacity: item.disabled ? 0.4 : 1,
              }}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                if (hasSub) {
                  setOpenIdx(open ? null : i);
                  return;
                }
                item.onClick?.();
                onClose();
              }}
            >
              <span style={{ width: 16, flexShrink: 0, color: '#00e676', fontWeight: 800 }}>{item.checked ? '✓' : ''}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
              {item.hint && <span style={{ color: '#607d8b', fontSize: 10, flexShrink: 0 }}>{item.hint}</span>}
              {hasSub && <span style={{ color: '#607d8b', flexShrink: 0 }}>▶</span>}
            </button>
            {hasSub && open && (
              <div
                className="ctx-menu"
                style={{
                  ...PANEL,
                  position: 'absolute',
                  top: -4,
                  ...(flip ? { right: '100%' } : { left: '100%' }),
                  maxHeight: 'min(70vh, 480px)',
                  overflowY: 'auto',
                }}
              >
                <MenuLevel items={item.submenu!} onClose={onClose} flip={flip} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export default function ContextMenu({ x, y, items, onClose }: MenuProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = panelRef.current;
    const w = Math.min(300, el?.offsetWidth || 250);
    const h = Math.min(window.innerHeight - 16, el?.offsetHeight || 400);
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - h - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('.ctx-menu')) return;
      onClose();
    };
    const onScroll = (e: Event) => {
      if (e.target instanceof HTMLElement && e.target.closest('.ctx-menu')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const flip = x > window.innerWidth - 560;

  return (
    <div ref={panelRef} className="ctx-menu" style={{ ...PANEL, left: pos.left, top: pos.top, scrollbarWidth: 'none' }} onContextMenu={e => e.preventDefault()}>
      <style>{'.ctx-menu::-webkit-scrollbar{display:none}.ctx-menu{scrollbar-width:none;-ms-overflow-style:none}.ctx-row:hover{background:#283247 !important}'}</style>
      <MenuLevel items={items} onClose={onClose} flip={flip} />
    </div>
  );
}
