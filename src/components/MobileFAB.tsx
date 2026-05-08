import React, { useState, useRef, useEffect } from 'react';
import { Plus, ArrowDown, ArrowUp } from 'lucide-react';

interface MobileFABProps {
  onAddTransaction: (type: 'expense' | 'income') => void;
}

export function MobileFAB({ onAddTransaction }: MobileFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [showChildren, setShowChildren] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShowChildren(true);
    } else {
      const t = setTimeout(() => setShowChildren(false), 200);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.isPrimary) {
      if (isOpen) {
        setIsOpen(false);
        return;
      }
      setIsPressing(true);
      timerRef.current = setTimeout(() => {
        setIsOpen(true);
        setIsPressing(false);
      }, 400); // 400ms long press
    }
  };

  const handlePointerUp = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    if (isPressing) {
      setIsPressing(false);
      if (!isOpen) {
        onAddTransaction('expense'); // Default action
      }
    }
  };

  const handlePointerLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressing(false);
  };

  return (
    <>
      {showChildren && (
        <div 
          className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-5 z-50 flex flex-col items-end gap-4">
        
        {showChildren && (
          <div
            className={`flex flex-col gap-3 transition-all duration-200 origin-bottom right-0 ${isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-90'}`}
          >
            <div 
              className="flex items-center gap-3 justify-end cursor-pointer group"
              onClick={() => { setIsOpen(false); onAddTransaction('income'); }}
            >
              <div className="bg-white dark:bg-[#121214] px-4 py-2 rounded-xl shadow-lg border border-gray-100 dark:border-white/10 text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-widest active:scale-95 transition-transform">
                Receita
              </div>
              <div className="w-12 h-12 bg-emerald-500 text-emerald-950 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform border border-emerald-400">
                <ArrowUp className="w-5 h-5" strokeWidth={3} />
              </div>
            </div>
            
            <div 
              className="flex items-center gap-3 justify-end cursor-pointer group"
              onClick={() => { setIsOpen(false); onAddTransaction('expense'); }}
            >
              <div className="bg-white dark:bg-[#121214] px-4 py-2 rounded-xl shadow-lg border border-gray-100 dark:border-white/10 text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-widest active:scale-95 transition-transform">
                Despesa
              </div>
              <div className="w-12 h-12 bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform border border-red-400">
                <ArrowDown className="w-5 h-5" strokeWidth={3} />
              </div>
            </div>
          </div>
        )}

        <button 
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerLeave}
          onContextMenu={(e) => e.preventDefault()}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 relative z-50 select-none ${isPressing ? 'scale-95' : 'scale-100'} ${isOpen ? 'bg-gray-800 dark:bg-[#121214] text-white border border-gray-700 dark:border-white/20' : 'bg-emerald-500 text-emerald-950 shadow-[0_8px_20px_rgba(16,185,129,0.4)]'}`}
        >
           {showChildren && isPressing && !isOpen && (
              <div
                className="absolute inset-0 rounded-full bg-emerald-200 dark:bg-emerald-400 pointer-events-none animate-[ping_0.4s_cubic-bezier(0,0,0.2,1)_forwards]"
              />
           )}
          <Plus className={`w-6 h-6 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`} strokeWidth={isOpen ? 2 : 2.5} />
        </button>
      </div>
    </>
  );
}
