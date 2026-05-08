import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface MonthYearPickerProps {
  currentMonth: number;
  currentYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const shortMonths = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export function MonthYearPicker({ currentMonth, currentYear, onMonthChange, onYearChange }: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 bg-white dark:bg-[#121214] border ${isOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-200 dark:border-white/10'} rounded-xl text-xs sm:text-sm font-semibold text-gray-900 dark:text-white px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm hover:border-emerald-500/50 transition-all group`}
      >
        <Calendar className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
        <span className="min-w-[110px] text-left">{months[currentMonth - 1]} {currentYear}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-transform duration-300 bg-gray-50 dark:bg-white/5 rounded-md p-0.5 ml-1 ${isOpen ? 'rotate-180 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-3 w-[300px] bg-white/80 dark:bg-[#18181b]/90 backdrop-blur-xl border border-gray-100 dark:border-white/10 rounded-2xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-left">
          {/* Subtle Decorative effect */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
          
          <div className="flex items-center justify-between mb-5 bg-gray-50/50 dark:bg-white/5 p-1 rounded-xl">
            <button 
              onClick={() => onYearChange(currentYear - 1)}
              className="p-2 rounded-lg hover:bg-white dark:hover:bg-white/10 hover:shadow-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-gray-900 dark:text-white font-mono tracking-tight">{currentYear}</span>
            <button 
              onClick={() => onYearChange(currentYear + 1)}
              className="p-2 rounded-lg hover:bg-white dark:hover:bg-white/10 hover:shadow-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {months.map((month, index) => {
              const isCurrent = index + 1 === currentMonth;
              return (
                <button
                  key={month}
                  onClick={() => {
                    onMonthChange(index + 1);
                    setIsOpen(false);
                  }}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl transition-all border ${
                    isCurrent 
                      ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_4px_12px_rgba(16,185,129,0.3)]' 
                      : 'bg-white dark:bg-transparent border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-200 dark:hover:border-white/10 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {shortMonths[index]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
