const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  '<div className="flex flex-col gap-3 mb-4">',
  `<div className="flex px-4 py-2 border-b border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-white/5 rounded-t-xl mt-4">
                                   <div className="flex-1 text-[10px] text-gray-500 font-semibold uppercase tracking-wider pl-4">Descrição</div>
                                   <div className="w-28 text-[10px] text-gray-500 font-semibold uppercase tracking-wider text-right pr-6">Valor Estimado</div>
                                </div>
                                <div className="flex flex-col mb-4 bg-gray-50 dark:bg-[#0A0A0B] rounded-b-xl border border-gray-200 dark:border-white/5 border-t-0 -mt-px overflow-hidden">`
);
fs.writeFileSync('src/App.tsx', code);
