const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Add import
if (!content.includes('import { DividasTab }')) {
  content = content.replace("import { SettingsTab } from './components/SettingsTab';", "import { SettingsTab } from './components/SettingsTab';\nimport { DividasTab } from './components/DividasTab';");
}

// 2. Add icon to imports
if (!content.includes('TrendingDown, Landmark')) {
  content = content.replace('TrendingDown, Activity', 'TrendingDown, Activity, Landmark');
}

// 3. Add to navigation
const navAnalysis = `<button onClick={() => setActiveTab('analysis')} className={\`p-2.5 md:p-3 rounded-2xl transition-all duration-300 relative group flex flex-col items-center gap-1 \${activeTab === 'analysis' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'}\`} title="Análise">
             <BarChart3 className={\`w-5 h-5 md:w-5 md:h-5 \${activeTab === 'analysis' ? 'transform scale-110' : 'group-hover:scale-110 transition-transform'}\`} />
             <div className={\`absolute -bottom-1 md:-right-1 md:bottom-auto w-1 md:w-1 h-1 md:h-full rounded-full bg-emerald-500 transition-opacity \${activeTab === 'analysis' ? 'opacity-100' : 'opacity-0'}\`}></div>
          </button>`;

const navDebts = `<button onClick={() => setActiveTab('debts')} className={\`p-2.5 md:p-3 rounded-2xl transition-all duration-300 relative group flex flex-col items-center gap-1 \${activeTab === 'debts' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'}\`} title="Dívidas">
             <Landmark className={\`w-5 h-5 md:w-5 md:h-5 \${activeTab === 'debts' ? 'transform scale-110' : 'group-hover:scale-110 transition-transform'}\`} />
             <div className={\`absolute -bottom-1 md:-right-1 md:bottom-auto w-1 md:w-1 h-1 md:h-full rounded-full bg-emerald-500 transition-opacity \${activeTab === 'debts' ? 'opacity-100' : 'opacity-0'}\`}></div>
          </button>`;

if (!content.includes("setActiveTab('debts')")) {
  content = content.replace(navAnalysis, navAnalysis + '\n          ' + navDebts);
}

// 4. Update title logic
if (!content.includes("activeTab === 'debts' ? 'Dívidas'")) {
  content = content.replace("activeTab === 'reserves' ? 'Reservas' :", "activeTab === 'reserves' ? 'Reservas' :\n                 activeTab === 'debts' ? 'Dívidas' :");
}

// 5. Add rendering block
const renderIntegration = `{activeTab === 'integration' && (
             <IntegrationTab user={user} userSettings={userSettings} />
           )}`;

const renderDebts = `{activeTab === 'debts' && (
             <DividasTab userId={user.uid} />
           )}`;

if (!content.includes("<DividasTab userId=")) {
  content = content.replace(renderIntegration, renderDebts + '\n\n           ' + renderIntegration);
}

fs.writeFileSync('src/App.tsx', content, 'utf-8');
console.log('App patched');
