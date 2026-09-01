const fs = require('fs');
let content = fs.readFileSync('src/components/DividasTab.tsx', 'utf-8');

// 1. Add recharts import
const importMatch = "import type { Debt } from '../types';";
const importReplace = `import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';\nimport type { Debt } from '../types';`;
if (!content.includes('PieChart')) {
  content = content.replace(importMatch, importReplace);
}

// 2. Prepare chart colors and data
const totalDebtMatch = "const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);";
const chartPreparation = `const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);

  const COLORS = ['#f43f5e', '#fb923c', '#f59e0b', '#84cc16', '#10b981', '#14b8a6', '#0ea5e9', '#6366f1', '#a855f7', '#d946ef'];
  const chartData = debts.map(d => ({ name: d.name, value: d.amount }));`;
content = content.replace(totalDebtMatch, chartPreparation);

// 3. Update summary card structure
const summaryCardMatch = `{/* Summary Card */}
      <div className="bg-white dark:bg-[#1A1A1D] rounded-2xl p-6 border border-gray-100 dark:border-white/5 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Total de Dívidas</h3>
        <p className="text-3xl font-bold font-mono tracking-tight text-rose-500">
          {formatCurrency(totalDebt)}
        </p>
      </div>`;

const summaryCardReplace = `{/* Summary & Chart */}
      <div className={\`grid grid-cols-1 \${debts.length > 0 ? 'lg:grid-cols-3' : ''} gap-6\`}>
        <div className="bg-white dark:bg-[#1A1A1D] rounded-2xl p-6 border border-gray-100 dark:border-white/5 shadow-sm flex flex-col justify-center">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Total de Dívidas</h3>
          <p className="text-3xl font-bold font-mono tracking-tight text-rose-500">
            {formatCurrency(totalDebt)}
          </p>
        </div>
        
        {debts.length > 0 && (
          <div className="lg:col-span-2 bg-white dark:bg-[#1A1A1D] rounded-2xl p-6 border border-gray-100 dark:border-white/5 shadow-sm h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#111827', fontWeight: 500 }}
                />
                <Legend 
                  verticalAlign="middle" 
                  align="right" 
                  layout="vertical" 
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>`;

content = content.replace(summaryCardMatch, summaryCardReplace);

fs.writeFileSync('src/components/DividasTab.tsx', content, 'utf-8');
console.log('patched');
