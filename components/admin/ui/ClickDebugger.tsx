'use client';

import { useState, useEffect, useCallback } from 'react';

type ElementInfo = {
  tag: string;
  classes: string;
  id: string;
  position: string;
  zIndex: string;
  pointerEvents: string;
  dimensions: string;
};

export function ClickDebugger() {
  const [enabled, setEnabled] = useState(false);
  const [clickInfo, setClickInfo] = useState<{
    x: number;
    y: number;
    elements: ElementInfo[];
  } | null>(null);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!enabled) return;

      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const infos: ElementInfo[] = elements.map((el) => {
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          classes: el.className && typeof el.className === 'string'
            ? el.className.split(' ').slice(0, 5).join(' ')
            : '',
          id: el.id || '',
          position: style.position,
          zIndex: style.zIndex,
          pointerEvents: style.pointerEvents,
          dimensions: `${el.clientWidth}x${el.clientHeight}`,
        };
      });

      setClickInfo({ x: e.clientX, y: e.clientY, elements: infos });
    },
    [enabled]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setEnabled((prev) => !prev);
        setClickInfo(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('click', handleClick, true);
      return () => document.removeEventListener('click', handleClick, true);
    }
  }, [enabled, handleClick]);

  if (!enabled) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[99999] max-w-md max-h-[60vh] overflow-auto bg-black/95 border border-yellow-500 rounded-lg p-4 text-xs font-mono"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-yellow-400 font-bold">Click Debugger ON</span>
        <button
          onClick={() => { setEnabled(false); setClickInfo(null); }}
          className="text-gray-400 hover:text-white"
        >
          Close
        </button>
      </div>
      <p className="text-gray-400 mb-2">Click anywhere to inspect element stack. Ctrl+Shift+D to toggle.</p>

      {clickInfo && (
        <div>
          <p className="text-green-400 mb-1">
            Click at ({clickInfo.x}, {clickInfo.y}) — {clickInfo.elements.length} elements
          </p>
          <div className="space-y-1">
            {clickInfo.elements.map((el, i) => (
              <div
                key={i}
                className={`p-1.5 rounded ${i === 0 ? 'bg-red-900/50 border border-red-500/50' : 'bg-gray-900/50 border border-gray-700'}`}
              >
                <div className="text-white">
                  {i === 0 && <span className="text-red-400">[TOP] </span>}
                  &lt;{el.tag}{el.id ? ` #${el.id}` : ''}&gt;
                </div>
                {el.classes && (
                  <div className="text-blue-300 truncate">.{el.classes.replace(/ /g, ' .')}</div>
                )}
                <div className="text-gray-400">
                  pos:{el.position} z:{el.zIndex} ptr:{el.pointerEvents} {el.dimensions}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
