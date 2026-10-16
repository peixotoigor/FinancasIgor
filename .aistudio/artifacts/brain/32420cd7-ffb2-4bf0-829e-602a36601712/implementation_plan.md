# Plano de Implementação — Liquid Glass Refinado & Sofisticado

Aprimoramento do design system da aplicação financeira para o padrão **Liquid Glass Refinado**, incorporando translucidez fluida, reflexos de luz especulares (micro-highlights nas bordas superiores), desfoque óptico (`backdrop-blur`) calibrado e sombras de profundidade com dispersão suave, tanto no modo **Claro** quanto no **Dark Profundo Iluminado**, preservando 100% da disposição dos grids, posições e layout já existentes.

---

## 1. Visão Geral das Melhorias de Design

### O Conceito "Liquid Glass"
- **Translúcido sutil & Backdrop Filter**: Em vez de cartões opacos comuns (`bg-white` / `bg-[#121214]`), os elementos principais adotam classes utilitárias ou tokens CSS que aplicam:
  - Fundo translúcido com gradiente linear sutil simulando vidro líquido:
    - *Modo Claro*: `bg-white/75 dark:bg-[#121216]/65 backdrop-blur-xl` com reflexo suave no topo `linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 100%)`.
    - *Modo Escuro*: `bg-[#0f0f13]/70 backdrop-blur-xl` com gradiente de borda interna `linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 100%)`.
  - **Bordas com Reflexo de Luz (Specular Border Highlight)**:
    - Borda ultra-fina `1px` com gradiente de luz refletida que destaca os contornos superiores e laterais (`border border-white/40 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]`).
  - **Luz de Fundo Ambiental (Ambient Glows)**:
    - Efeito de profundidade com orbs e gradientes radiais suaves e fixos no plano de fundo (tons esmeralda, índigo e ciano com opacidade sutil) que evidenciam a refração do vidro ao rolar a página.

### Alternador (Toggle) do Efeito Glass
- Criação de uma opção de preferência nas **Configurações** (e acesso rápido no Header/Sidebar):
  - Chave persistente em `localStorage` (e sincronizável no `userSettings`): `enableLiquidGlass` (padrão: `true`).
  - Quando desativado: a interface retorna ao visual limpo sólido padrão de alta performance, sem quebra visual.

---

## 2. Escopo e Arquitetura de Mudanças

### A. Estilos Globais e Tokens (`src/index.css`)
1. **Definição de classes de utilidade para o Liquid Glass**:
   - `.glass-card`: Container base translúcido com reflexo linear superior, borda iluminada e backdrop-blur calibrado (16px–24px).
   - `.glass-card-hover`: Interação suave com brilho de reflexo e leve realce de borda ao passar o cursor.
   - `.glass-nav`: Efeito de vidro refinado para a barra de navegação lateral e cabeçalhos fixos.
   - `.glass-subtle`: Para itens de lista, badges e containers secundários internos.
   - Gradientes de iluminação ambiente no container com opacidade sutil para criar o efeito de refração de vidro nos dois modos (Claro e Escuro).

### B. Gerenciamento de Estado e Preferência (`src/App.tsx` & `src/types.ts`)
1. **Estado `isLiquidGlass`**:
   - `const [isLiquidGlass, setIsLiquidGlass] = useState<boolean>(() => localStorage.getItem('liquid_glass') !== 'false');`
   - Atualização persistente no `localStorage` e adição de classe global `.liquid-glass-enabled` no container raiz.
2. **Atualização da Sidebar & Header**:
   - Aplicação do estilo de vidro com profundidade no menu lateral (`nav`) e cabeçalho.
   - Botão discreto de toggle ou acesso em Configurações.

### C. Refatoração dos Grids e Componentes (Mantendo 100% da Disposição)
1. **Painel Visão Geral (`App.tsx`)**:
   - Cards de métricas superiores (Receitas, Despesas, Saldo Líquido, Economia): aplicam `.glass-card`.
   - Grid de Planejamento Mensal (`MonthlyPlanning`): mantém posições, ganha acabamento translúcido e reflexos nas bordas.
   - Lista "Últimas do Mês" e Sidebar Direita: preservam a ordem das colunas e a funcionalidade de drag & drop, com cartões de transação em relevo vítreo refinado.
2. **Componente de Configurações (`SettingsTab.tsx`)**:
   - Adição do controle de alternância: **"Efeito Liquid Glass"** (Ativar/Desativar efeito translúcido e reflexos vítreos).
3. **Abas Restantes (`TransactionsTab`, `ReservesTab`, `DividasTab`, `AnalysisTab`)**:
   - Aplicação harmoniosa da classe condicional `.glass-card`, respeitando o toggle global para uma experiência coesa em todo o app.

---

## 3. Critérios de Sucesso e Validação
- **Preservação de Grids**: Nenhuma coluna, padding crítico ou proporção de layout será quebrada ou deslocada.
- **Leitura & Contraste**: Tipografia em conformidade de contraste (textos nítidos em modo claro e escuro, sem opacidade excessiva que prejudique a leitura de valores financeiros).
- **Desempenho**: Desfoque com aceleração de hardware (`will-change: transform`, `backdrop-filter: blur(...)`) e opção instantânea de desativação para dispositivos com menor poder gráfico.
- **Compilação**: `compile_applet` e testes de execução sem erros de tipagem TypeScript ou ESLint.
