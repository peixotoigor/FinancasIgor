import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Plus, Trash2, TrendingDown, Calendar, Percent, Landmark, PencilLine, X, Bot, Send, ArrowRight, BrainCircuit } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import type { Debt, UserSettings } from '../types';

interface DividasTabProps {
  userId: string;
  userSettings: UserSettings | null;
}

export function DividasTab({ userId, userSettings }: DividasTabProps) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [averageIncome, setAverageIncome] = useState<number>(0);

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [installments, setInstallments] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // AI & Payment States
  const [activeDebtAI, setActiveDebtAI] = useState<Debt | null>(null);
  const [aiProjection, setAiProjection] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [paymentModalDebt, setPaymentModalDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    if (!userId) return;

    // Fetch average income for last 6 months
    const fetchIncome = async () => {
      try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const qIncome = query(
          collection(db, 'transactions'),
          where('userId', '==', userId),
          where('type', '==', 'income'),
          where('date', '>=', sixMonthsAgo.getTime())
        );
        onSnapshot(qIncome, (snap) => {
          let total = 0;
          snap.forEach(d => { total += d.data().amount; });
          setAverageIncome(total / 6);
        });
      } catch (e) {
        console.error(e);
      }
    };
    fetchIncome();

    const q = query(
      collection(db, 'debts'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const debtsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Debt[];
      
      setDebts(debtsData.sort((a, b) => b.amount - a.amount));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching debts:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const formatAmountInput = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    const numAmount = (parseInt(numbers) / 100).toFixed(2);
    return numAmount.replace('.', ',');
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const startEdit = (debt: Debt) => {
    setEditingId(debt.id);
    setName(debt.name);
    setAmount(debt.amount.toFixed(2).replace('.', ','));
    setInterestRate(debt.interestRate ? debt.interestRate.toString().replace('.', ',') : '');
    setInstallments(debt.installments ? debt.installments.toString() : '');
    setDueDate(debt.dueDate ? debt.dueDate.toString() : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setInterestRate('');
    setInstallments('');
    setDueDate('');
  };

  const generateAIProjection = async (debt: Debt) => {
    setActiveDebtAI(debt);
    setIsAiLoading(true);
    setAiProjection('');
    
    try {
            const prompt = `Aja como um consultor financeiro. O usuário tem uma dívida de R$ ${debt.amount.toFixed(2)} chamada "${debt.name}"${debt.interestRate ? ` com juros de ${debt.interestRate}% ao mês` : ''}.\nA renda média mensal dele nos últimos 6 meses é de R$ ${averageIncome.toFixed(2)}.\nResponda de forma direta e curta:\n1. Avalie rapidamente se o valor dessa dívida está alto ou tranquilo para essa renda média (máx 2 linhas).\n2. Calcule e sugira projeções exatas de pagamento (valor da parcela mensal) para quitar a dívida em 3x, 6x, 9x e 12x, considerando os juros (se houver).\nFormate com emojis e bullet points limpos.`;

      const response = await fetch('/api/ai/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          systemInstruction: "Você é um consultor financeiro sênior especializado em planejamento e quitação de dívidas para brasileiros. Forneça respostas exatas, realistas e financeiramente matemáticas e diretas, estruturadas com bullet points limpos.",
          openRouterKey: userSettings?.openRouterApiKey,
          openRouterModel: userSettings?.openRouterModel
        })
      });
      const data = await response.json();
      if (!response.ok) {
         const errMsg = typeof data.error === 'string' ? data.error : (data.error?.message || 'Erro na API');
         if (errMsg.toLowerCase().includes('api key')) {
             throw new Error('⚠️ Ops! Sua Chave de API do Gemini não está configurada ou é inválida. Vá em Configurações (Settings) e adicione uma chave válida para usar a IA.');
         }
         throw new Error(errMsg);
      }
      setAiProjection(data.text || 'Nenhuma projeção gerada.');
    } catch (error: any) {
      console.error(error);
      setAiProjection(error.message || 'Desculpe, não foi possível gerar a projeção no momento.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePostPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalDebt || !paymentAmount) return;
    
    const numAmount = parseFloat(paymentAmount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) return;

    try {
      // 1. Create expense transaction
      await addDoc(collection(db, 'transactions'), {
        userId,
        description: `Pagamento: ${paymentModalDebt.name}`,
        amount: numAmount,
        type: 'expense',
        category: 'Dívidas e Empréstimos',
        date: Date.now(),
        createdAt: Date.now()
      });

      // 2. Reduce debt amount
      const newDebtAmount = Math.max(0, paymentModalDebt.amount - numAmount);
      await setDoc(doc(db, 'debts', paymentModalDebt.id), { amount: newDebtAmount }, { merge: true });

      setPaymentModalDebt(null);
      setPaymentAmount('');
    } catch (error) {
      console.error("Error posting payment", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;

    const numAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) return;

    setIsSaving(true);
    try {
      const debtId = editingId || crypto.randomUUID();
      const debtRef = doc(db, 'debts', debtId);
      
      const debtData: any = {
        id: debtId,
        userId,
        name,
        amount: numAmount,
        createdAt: editingId ? (debts.find(d => d.id === editingId)?.createdAt || Date.now()) : Date.now()
      };
      
      if (interestRate) debtData.interestRate = parseFloat(interestRate.replace(',', '.'));
      if (installments) debtData.installments = parseInt(installments, 10);
      if (dueDate) debtData.dueDate = parseInt(dueDate, 10);

      await setDoc(debtRef, debtData, { merge: true });
      resetForm();
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'debts');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta dívida?')) return;
    try {
      await deleteDoc(doc(db, 'debts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'debts');
    }
  };

  const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);

  const COLORS = ['#f43f5e', '#fb923c', '#f59e0b', '#84cc16', '#10b981', '#14b8a6', '#0ea5e9', '#6366f1', '#a855f7', '#d946ef'];
  const chartData = debts.map(d => ({ name: d.name, value: d.amount }));

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center">
          <TrendingDown className="w-5 h-5 text-rose-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Controle de Dívidas</h2>
          <p className="text-sm text-gray-500">Cadastre e acompanhe seus passivos financeiros</p>
        </div>
      </div>

      {/* Summary & Chart */}
      <div className={`grid grid-cols-1 ${debts.length > 0 ? 'lg:grid-cols-3' : ''} gap-6`}>
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
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-[#1A1A1D] rounded-2xl p-6 border border-gray-100 dark:border-white/5 shadow-sm">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">
          {editingId ? 'Editar Dívida' : 'Nova Dívida'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Credor / Descrição *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Empréstimo Nubank"
                className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Saldo Devedor Atual (R$) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(formatAmountInput(e.target.value))}
                  placeholder="0,00"
                  className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm font-mono outline-none focus:border-rose-500 transition-colors"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Taxa de Juros Mensal (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  placeholder="Ex: 1,99"
                  className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl pl-3 pr-8 py-2 text-sm font-mono outline-none focus:border-rose-500 transition-colors"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Parcelas Restantes</label>
                <input
                  type="number"
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                  placeholder="Ex: 12"
                  className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-rose-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Dia do Vencimento</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    placeholder="Ex: 10"
                    className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm font-mono outline-none focus:border-rose-500 transition-colors"
                  />
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-white/5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving || !name || !amount}
              className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {editingId ? <PencilLine className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingId ? 'Salvar Alterações' : 'Adicionar Dívida'}
            </button>
          </div>
        </form>
      </div>

      {/* Debt List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 ml-1">Suas Dívidas</h3>
        
        {debts.length === 0 ? (
          <div className="bg-white dark:bg-[#1A1A1D] border border-gray-100 dark:border-white/5 rounded-2xl p-8 text-center text-gray-500 text-sm shadow-sm">
            Nenhuma dívida cadastrada. Que ótima notícia!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {debts.map(debt => (
              <div key={debt.id} className="bg-white dark:bg-[#1A1A1D] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm hover:border-gray-200 dark:hover:border-white/10 transition-colors group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#0A0A0B] flex items-center justify-center shrink-0">
                      <Landmark className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <h4 className="font-bold text-gray-900 dark:text-white truncate pr-4">{debt.name}</h4>
                  </div>
                  <div className="flex items-center gap-1 transition-opacity">
                    <button
                      onClick={() => generateAIProjection(debt)}
                      className="p-1.5 text-gray-400 hover:text-emerald-500 transition-colors"
                      title="Análise com IA"
                    >
                      <BrainCircuit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setPaymentModalDebt(debt); setPaymentAmount(''); }}
                      className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"
                      title="Lançar Pagamento"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => startEdit(debt)}
                      className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"
                      title="Editar"
                    >
                      <PencilLine className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(debt.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <p className="text-2xl font-bold font-mono tracking-tight text-gray-900 dark:text-white mb-4">
                  {formatCurrency(debt.amount)}
                </p>
                
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-white/5 text-sm">
                  {debt.interestRate !== undefined && (
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Percent className="w-3.5 h-3.5" />
                      <span>{debt.interestRate}% ao mês</span>
                    </div>
                  )}
                  {debt.installments !== undefined && (
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{debt.installments}x restantes</span>
                    </div>
                  )}
                  {debt.dueDate !== undefined && (
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <span className="w-3.5 h-3.5 flex items-center justify-center border border-gray-400 rounded-sm text-[8px] font-bold">V</span>
                      <span>Dia {debt.dueDate}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Projection Modal */}
      {activeDebtAI && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1A1A1D] w-full max-w-lg rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-white/10 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/5 bg-gradient-to-r from-emerald-500/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Projeção Inteligente</h3>
                  <p className="text-xs text-gray-500">Baseada na renda média de {formatCurrency(averageIncome)}</p>
                </div>
              </div>
              <button onClick={() => setActiveDebtAI(null)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              {isAiLoading ? (
                <div className="flex flex-col items-center justify-center py-8 text-emerald-500">
                  <div className="w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-medium animate-pulse">A IA está analisando sua dívida...</p>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {(aiProjection || '').split('\n').map((line, i) => (
                    <p key={i} className="mb-2 text-gray-700 dark:text-gray-300 leading-relaxed">{line}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModalDebt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1A1A1D] w-full max-w-sm rounded-3xl shadow-xl p-6 border border-gray-100 dark:border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-500" />
                Lançar Pagamento
              </h3>
              <button onClick={() => setPaymentModalDebt(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Ao lançar este pagamento, uma despesa será criada e o saldo da dívida <strong className="text-gray-900 dark:text-white">{paymentModalDebt.name}</strong> será reduzido.
            </p>

            <form onSubmit={handlePostPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Valor do Pagamento</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                  <input
                    type="text"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(formatAmountInput(e.target.value))}
                    placeholder="0,00"
                    className="w-full bg-gray-50 dark:bg-[#0A0A0B] border border-gray-200 dark:border-white/10 rounded-xl pl-8 pr-3 py-3 text-sm font-mono outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!paymentAmount}
                className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl transition-colors font-medium disabled:opacity-50"
              >
                Confirmar Lançamento <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
