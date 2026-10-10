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
    <div className="relative font-sans" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 px-3 sm:px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 shadow-sm transition-colors"
      >
        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
        <span className="min-w-[110px] text-left">{months[currentMonth - 1]} {currentYear}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[280px] sm:w-[300px] bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl z-50 p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-white/5">
            <button 
              onClick={() => onYearChange(currentYear - 1)}
              className="p-1 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              title="Ano anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-sm text-gray-900 dark:text-white">{currentYear}</span>
            <button 
              onClick={() => onYearChange(currentYear + 1)}
              className="p-1 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              title="Próximo ano"
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
                  className={`py-2 px-1 text-xs rounded-xl font-medium transition-colors ${
                    isCurrent 
                      ? 'bg-emerald-500 text-white font-bold shadow-sm shadow-emerald-500/20' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
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
