/**
 * FINANCE OS — Personal Financial Management System
 * Core Engine & Business Logic (Vanilla JavaScript)
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. CONSTANTS & SYSTEM CONFIGURATION
  // =========================================================================
  const STORAGE_KEY = 'FINANCE_OS_DATA_V2';

  const DEFAULT_CATEGORIES = {
    income: [
      'Gaji Pokok',
      'Freelance & Proyek',
      'Bisnis & Usaha',
      'Investasi & Dividen',
      'Konten & Adsense',
      'Hadiah & Bonus',
      'Lainnya'
    ],
    expense: [
      'Makanan & Minuman',
      'Transportasi',
      'Tagihan & Utilitas',
      'Belanja & Kebutuhan',
      'Hiburan & Rekreasi',
      'Kesehatan & Medis',
      'Pendidikan & Kursus',
      'Keluarga & Donasi',
      'Cicilan & Utang',
      'Investasi / Tabungan',
      'Lainnya'
    ]
  };

  const CATEGORY_COLORS = {
    'Makanan & Minuman': '#F59E0B',
    'Transportasi': '#3B82F6',
    'Tagihan & Utilitas': '#EF4444',
    'Belanja & Kebutuhan': '#EC4899',
    'Hiburan & Rekreasi': '#8B5CF6',
    'Kesehatan & Medis': '#10B981',
    'Pendidikan & Kursus': '#06B6D4',
    'Keluarga & Donasi': '#F97316',
    'Cicilan & Utang': '#DC2626',
    'Investasi / Tabungan': '#22C55E',
    'Gaji Pokok': '#22C55E',
    'Freelance & Proyek': '#3B82F6',
    'Bisnis & Usaha': '#8B5CF6',
    'Investasi & Dividen': '#10B981',
    'Konten & Adsense': '#F59E0B',
    'Lainnya': '#64748B'
  };

  // State object
  let state = {
    settings: {
      userName: 'John Doe',
      currency: 'IDR',
      dateFormat: 'id-ID',
      theme: 'dark'
    },
    accounts: [],
    transactions: [],
    budgets: [],
    savingsGoals: [],
    incomes: [],
    investments: [],
    debts: []
  };

  // Active chart instances to prevent canvas collision
  const chartInstances = {};

  // Delete confirmation callback store
  let pendingConfirmAction = null;

  // Active transaction type inside modal
  let currentTxType = 'expense';

  // Filters for Transactions view
  const txFilterState = {
    search: '',
    type: 'all',
    category: 'all',
    account: 'all',
    month: 'all'
  };

  // Filter for Income view
  let activeIncomeTab = 'all';

  // Filter for Debt view
  let activeDebtTab = 'all';

  // Filter for Report view
  let activeReportRange = 'this_month';

  // =========================================================================
  // 2. HELPER UTILITIES & FORMATTERS
  // =========================================================================

  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  function formatCurrency(amount, currency = state.settings.currency || 'IDR') {
    const num = Number(amount) || 0;
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
    }
    // Default IDR
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  }

  function formatDate(dateStr, formatStyle = state.settings.dateFormat || 'id-ID') {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
      if (isNaN(date.getTime())) return dateStr;

      if (formatStyle === 'ISO') {
        return date.toISOString().split('T')[0];
      }

      if (formatStyle === 'en-US') {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }

      // Default ID
      return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function getMonthYearStr(dateStr) {
    if (!dateStr) return '';
    return dateStr.substring(0, 7); // "YYYY-MM"
  }

  function getCurrentMonthStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function getTodayStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatMonthLabel(ymStr) {
    if (!ymStr) return '';
    const [year, month] = ymStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }

  function getCategoryColor(categoryName) {
    return CATEGORY_COLORS[categoryName] || '#64748B';
  }

  // =========================================================================
  // 3. TOAST NOTIFICATIONS
  // =========================================================================
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';
    if (type === 'info') iconName = 'info';

    toast.innerHTML = `
      <i data-lucide="${iconName}" class="toast-icon"></i>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================================================================
  // 4. STORAGE & INITIAL DEMO DATA
  // =========================================================================

  function generateDemoData() {
    const currentMonth = getCurrentMonthStr();
    const today = getTodayStr();

    // Accounts
    const accounts = [
      {
        id: 'acc_bca',
        name: 'Bank BCA Utama',
        type: 'bank',
        balance: 28500000,
        number: '8271-9281-00',
        color: '#3B82F6',
        createdAt: today
      },
      {
        id: 'acc_mandiri',
        name: 'Bank Mandiri Payroll',
        type: 'bank',
        balance: 14200000,
        number: '137-00-1928374-1',
        color: '#F59E0B',
        createdAt: today
      },
      {
        id: 'acc_gopay',
        name: 'GoPay & E-Wallet',
        type: 'wallet',
        balance: 1450000,
        number: '0812-8899-7766',
        color: '#22C55E',
        createdAt: today
      },
      {
        id: 'acc_cash',
        name: 'Uang Tunai (Dompet Fisik)',
        type: 'cash',
        balance: 750000,
        number: 'Cash in Hand',
        color: '#64748B',
        createdAt: today
      },
      {
        id: 'acc_cc',
        name: 'BCA Everyday Card',
        type: 'credit',
        balance: 2400000, // liability amount
        number: '4556-xxxx-xxxx-8812',
        color: '#EF4444',
        createdAt: today
      }
    ];

    // Transactions
    const transactions = [
      {
        id: 'tx_1',
        type: 'income',
        category: 'Gaji Pokok',
        amount: 22500000,
        accountId: 'acc_bca',
        toAccountId: null,
        date: `${currentMonth}-01`,
        description: 'Gaji Bulanan PT Inovasi Solusi Digital',
        notes: 'Gaji tetap take home pay'
      },
      {
        id: 'tx_2',
        type: 'income',
        category: 'Freelance & Proyek',
        amount: 9800000,
        accountId: 'acc_mandiri',
        toAccountId: null,
        date: `${currentMonth}-04`,
        description: 'Pembayaran UI/UX Web Dashboard SaaS (SG Client)',
        notes: 'Proyek desain selesai'
      },
      {
        id: 'tx_3',
        type: 'expense',
        category: 'Tagihan & Utilitas',
        amount: 1850000,
        accountId: 'acc_bca',
        toAccountId: null,
        date: `${currentMonth}-03`,
        description: 'Listrik PLN, WiFi Fiber 100Mbps, & Air PDAM',
        notes: 'Tagihan rutin bulanan'
      },
      {
        id: 'tx_4',
        type: 'expense',
        category: 'Makanan & Minuman',
        amount: 2400000,
        accountId: 'acc_bca',
        toAccountId: null,
        date: `${currentMonth}-05`,
        description: 'Belanja Bulanan Supermarket & Bahan Dapur',
        notes: 'Kebutuhan stok makanan'
      },
      {
        id: 'tx_5',
        type: 'expense',
        category: 'Transportasi',
        amount: 650000,
        accountId: 'acc_gopay',
        toAccountId: null,
        date: `${currentMonth}-07`,
        description: 'Bensin Pertamax & Saldo Tol E-Toll',
        notes: 'Mobilitas kantor'
      },
      {
        id: 'tx_6',
        type: 'expense',
        category: 'Hiburan & Rekreasi',
        amount: 350000,
        accountId: 'acc_gopay',
        toAccountId: null,
        date: `${currentMonth}-09`,
        description: 'Langganan Netflix, Spotify, & YouTube Premium',
        notes: 'Hiburan langganan digital'
      },
      {
        id: 'tx_7',
        type: 'transfer',
        category: 'Transfer Antar Akun',
        amount: 1000000,
        accountId: 'acc_bca',
        toAccountId: 'acc_gopay',
        date: `${currentMonth}-10`,
        description: 'Top-up saldo GoPay mingguan',
        notes: 'Biaya admin Rp 0'
      },
      {
        id: 'tx_8',
        type: 'expense',
        category: 'Makanan & Minuman',
        amount: 450000,
        accountId: 'acc_gopay',
        toAccountId: null,
        date: `${currentMonth}-12`,
        description: 'Makan Malam Restoran bersama Rekan Kerja',
        notes: 'Dine out'
      },
      {
        id: 'tx_9',
        type: 'income',
        category: 'Investasi & Dividen',
        amount: 1250000,
        accountId: 'acc_mandiri',
        toAccountId: null,
        date: `${currentMonth}-13`,
        description: 'Dividen Kupon Obligasi Negara ORI025',
        notes: 'Passive income kupon bulanan'
      }
    ];

    // Budgets
    const budgets = [
      {
        id: 'bgt_1',
        category: 'Makanan & Minuman',
        amount: 4500000,
        month: currentMonth
      },
      {
        id: 'bgt_2',
        category: 'Tagihan & Utilitas',
        amount: 2500000,
        month: currentMonth
      },
      {
        id: 'bgt_3',
        category: 'Transportasi',
        amount: 1500000,
        month: currentMonth
      },
      {
        id: 'bgt_4',
        category: 'Belanja & Kebutuhan',
        amount: 3000000,
        month: currentMonth
      },
      {
        id: 'bgt_5',
        category: 'Hiburan & Rekreasi',
        amount: 1200000,
        month: currentMonth
      }
    ];

    // Savings Goals
    const savingsGoals = [
      {
        id: 'goal_1',
        title: 'Dana Darurat 6 Bulan Pengeluaran',
        targetAmount: 60000000,
        currentAmount: 42000000,
        deadline: '2027-06-30',
        category: 'Dana Darurat'
      },
      {
        id: 'goal_2',
        title: 'Upgrade Workstation MacBook M-Series',
        targetAmount: 32000000,
        currentAmount: 25500000,
        deadline: '2027-03-31',
        category: 'Gadget'
      },
      {
        id: 'goal_3',
        title: 'Liburan Akhir Tahun Jepang',
        targetAmount: 35000000,
        currentAmount: 14000000,
        deadline: '2027-11-20',
        category: 'Liburan'
      }
    ];

    // Income streams & Invoices
    const incomes = [
      {
        id: 'inc_1',
        source: 'PT Inovasi Solusi Digital',
        type: 'Gaji Pokok',
        amount: 22500000,
        dueDate: `${currentMonth}-01`,
        status: 'received',
        accountId: 'acc_bca'
      },
      {
        id: 'inc_2',
        source: 'SaaS Client SG (UI/UX Redesign)',
        type: 'Freelance',
        amount: 9800000,
        dueDate: `${currentMonth}-04`,
        status: 'received',
        accountId: 'acc_mandiri'
      },
      {
        id: 'inc_3',
        source: 'Studio Animasi & Motion Pitch Deck',
        type: 'Freelance',
        amount: 7500000,
        dueDate: `${currentMonth}-25`,
        status: 'pending',
        accountId: 'acc_bca'
      },
      {
        id: 'inc_4',
        source: 'YouTube AdSense & Sponsor Bulanan',
        type: 'Konten Kreator',
        amount: 3200000,
        dueDate: `${currentMonth}-22`,
        status: 'pending',
        accountId: 'acc_mandiri'
      }
    ];

    // Investments
    const investments = [
      {
        id: 'inv_1',
        name: 'BBCA (Bank Central Asia)',
        type: 'Saham',
        quantity: 2000, // 20 Lot
        buyPrice: 9150,
        currentPrice: 10100
      },
      {
        id: 'inv_2',
        name: 'Sucorinvest Equity Fund',
        type: 'Reksadana',
        quantity: 12000,
        buyPrice: 2150,
        currentPrice: 2420
      },
      {
        id: 'inv_3',
        name: 'Emas Fisik Logam Mulia Antam',
        type: 'Emas',
        quantity: 25, // 25 Gram
        buyPrice: 1150000,
        currentPrice: 1460000
      },
      {
        id: 'inv_4',
        name: 'Bitcoin (BTC)',
        type: 'Kripto',
        quantity: 0.042,
        buyPrice: 850000000,
        currentPrice: 1420000000
      }
    ];

    // Debts & Receivables
    const debts = [
      {
        id: 'debt_1',
        type: 'payable',
        counterparty: 'KTA Bank Mandiri Renovasi Studio',
        totalAmount: 20000000,
        paidAmount: 14000000,
        dueDate: '2027-05-15',
        interest: '0.8% flat / bulan',
        notes: 'Cicilan 10 dari 12 bulan'
      },
      {
        id: 'debt_2',
        type: 'receivable',
        counterparty: 'Budi Santoso (Pinjaman Modal Usaha)',
        totalAmount: 6000000,
        paidAmount: 3000000,
        dueDate: `${currentMonth}-30`,
        interest: 'Bebas Bunga',
        notes: 'Perjanjian pelunasan akhir bulan'
      }
    ];

    return {
      settings: {
        userName: 'John Doe',
        currency: 'IDR',
        dateFormat: 'id-ID',
        theme: 'dark'
      },
      accounts,
      transactions,
      budgets,
      savingsGoals,
      incomes,
      investments,
      debts
    };
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        state = JSON.parse(stored);
        // Ensure all collections exist
        state.settings = state.settings || { userName: 'John Doe', currency: 'IDR', dateFormat: 'id-ID', theme: 'dark' };
        state.accounts = state.accounts || [];
        state.transactions = state.transactions || [];
        state.budgets = state.budgets || [];
        state.savingsGoals = state.savingsGoals || [];
        state.incomes = state.incomes || [];
        state.investments = state.investments || [];
        state.debts = state.debts || [];
      } else {
        state = generateDemoData();
        saveState();
      }
    } catch (err) {
      console.error('Failed to load local storage state:', err);
      state = generateDemoData();
      saveState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save to local storage:', e);
      showToast('Gagal menyimpan perubahan ke LocalStorage', 'error');
    }
  }

  // =========================================================================
  // 5. CORE FINANCIAL CALCULATIONS
  // =========================================================================

  /**
   * Calculate exact balance for each account.
   * Total balance = sum of liquid asset accounts - sum of credit card liabilities.
   */
  function calculateFinancialSummary(periodMonth = getCurrentMonthStr()) {
    // 1. Total liquid balance & liabilities
    let totalLiquidAssets = 0;
    let totalLiabilitiesAcc = 0;

    state.accounts.forEach(acc => {
      const bal = Number(acc.balance) || 0;
      if (acc.type === 'credit') {
        totalLiabilitiesAcc += bal;
      } else {
        totalLiquidAssets += bal;
      }
    });

    const netLiquidBalance = totalLiquidAssets - totalLiabilitiesAcc;

    // 2. Period Transactions (Income & Expenses)
    let periodIncome = 0;
    let periodExpense = 0;
    let periodIncomeCount = 0;
    let periodExpenseCount = 0;

    state.transactions.forEach(tx => {
      const txMonth = getMonthYearStr(tx.date);
      if (!periodMonth || txMonth === periodMonth) {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') {
          periodIncome += amt;
          periodIncomeCount++;
        } else if (tx.type === 'expense') {
          periodExpense += amt;
          periodExpenseCount++;
        }
      }
    });

    const netCashflow = periodIncome - periodExpense;

    // 3. Savings Rate: (Net Cashflow / Total Income) * 100%
    let savingsRate = 0;
    if (periodIncome > 0 && netCashflow > 0) {
      savingsRate = (netCashflow / periodIncome) * 100;
    }

    // 4. Investment Valuation
    let totalInvested = 0;
    let totalInvestmentMarketValue = 0;
    state.investments.forEach(inv => {
      const qty = Number(inv.quantity) || 0;
      const buy = Number(inv.buyPrice) || 0;
      const cur = Number(inv.currentPrice) || 0;
      totalInvested += qty * buy;
      totalInvestmentMarketValue += qty * cur;
    });
    const investmentProfitLoss = totalInvestmentMarketValue - totalInvested;

    // 5. Debts & Receivables
    let totalOutstandingPayable = 0; // Utang saya
    let totalOutstandingReceivable = 0; // Piutang saya

    state.debts.forEach(d => {
      const total = Number(d.totalAmount) || 0;
      const paid = Number(d.paidAmount) || 0;
      const remaining = Math.max(0, total - paid);

      if (d.type === 'payable') {
        totalOutstandingPayable += remaining;
      } else if (d.type === 'receivable') {
        totalOutstandingReceivable += remaining;
      }
    });

    // 6. Net Worth Master Calculation:
    // Net Worth = (Total Liquid Assets + Investment Market Value + Outstanding Receivables)
    //             - (Total Account Liabilities + Outstanding Payables)
    const totalAssets = totalLiquidAssets + totalInvestmentMarketValue + totalOutstandingReceivable;
    const totalLiabilities = totalLiabilitiesAcc + totalOutstandingPayable;
    const netWorth = totalAssets - totalLiabilities;

    return {
      totalLiquidAssets,
      totalLiabilitiesAcc,
      netLiquidBalance,
      periodIncome,
      periodExpense,
      periodIncomeCount,
      periodExpenseCount,
      netCashflow,
      savingsRate,
      totalInvested,
      totalInvestmentMarketValue,
      investmentProfitLoss,
      totalOutstandingPayable,
      totalOutstandingReceivable,
      totalAssets,
      totalLiabilities,
      netWorth
    };
  }

  // =========================================================================
  // 6. VIEW NAVIGATION SYSTEM
  // =========================================================================
  function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');

    const viewTitles = {
      dashboard: {
        title: 'Dashboard',
        subtitle: 'Ikhtisar performa keuangan pribadi Anda secara komprehensif.'
      },
      transactions: {
        title: 'Daftar Transaksi',
        subtitle: 'Kelola catatan pemasukan, pengeluaran, dan transfer antar rekening.'
      },
      accounts: {
        title: 'Rekening & Dompet',
        subtitle: 'Pantau saldo rekening bank, e-wallet, uang tunai, dan liabilitas kartu.'
      },
      budget: {
        title: 'Anggaran Bulanan',
        subtitle: 'Kendalikan pengeluaran per kategori agar terhindar dari overbudget.'
      },
      savings: {
        title: 'Target Tabungan',
        subtitle: 'Capai dana darurat, liburan impian, dan target aset masa depan.'
      },
      income: {
        title: 'Sumber Pendapatan',
        subtitle: 'Pantau gaji, invoice proyek freelance, dan aliran pendapatan pasif.'
      },
      investments: {
        title: 'Portofolio Investasi',
        subtitle: 'Pantau aset saham, reksadana, emas, kripto, dan valuasi terkini.'
      },
      debt: {
        title: 'Utang & Piutang',
        subtitle: 'Kelola jadwal jatuh tempo kewajiban utang dan tagihan piutang Anda.'
      },
      reports: {
        title: 'Laporan & Analisis',
        subtitle: 'Analisis mendalam arus kas, komposisi pengeluaran, dan tren Net Worth.'
      },
      settings: {
        title: 'Pengaturan Sistem',
        subtitle: 'Konfigurasi profil mata uang, backup ekspor JSON, dan pemulihan data.'
      }
    };

    function switchView(viewName) {
      if (!viewTitles[viewName]) viewName = 'dashboard';

      // Update nav links
      navLinks.forEach(link => {
        if (link.dataset.view === viewName) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });

      // Update sections
      sections.forEach(sec => {
        if (sec.id === `view-${viewName}`) {
          sec.classList.add('active');
        } else {
          sec.classList.remove('active');
        }
      });

      // Update page title
      const meta = viewTitles[viewName];
      if (pageTitle) pageTitle.textContent = meta.title;
      if (pageSubtitle) pageSubtitle.textContent = meta.subtitle;

      // Close mobile sidebar if open
      closeMobileSidebar();

      // Render view-specific data
      renderActiveView(viewName);

      // Re-trigger icons
      if (window.lucide) window.lucide.createIcons();
    }

    // Event listeners on nav links
    navLinks.forEach(link => {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        const view = this.dataset.view;
        window.location.hash = view;
        switchView(view);
      });
    });

    // In-page view jumps
    document.addEventListener('click', function (e) {
      const target = e.target.closest('[data-view]');
      if (target && !target.classList.contains('nav-link')) {
        e.preventDefault();
        const view = target.dataset.view;
        window.location.hash = view;
        switchView(view);
      }
    });

    // Hash change handler
    window.addEventListener('hashchange', function () {
      const hash = window.location.hash.replace('#', '');
      if (hash && viewTitles[hash]) {
        switchView(hash);
      }
    });

    // Initial view from hash or default dashboard
    const initialHash = window.location.hash.replace('#', '');
    switchView(initialHash || 'dashboard');
  }

  function renderActiveView(viewName) {
    updateTopIndicators();

    switch (viewName) {
      case 'dashboard':
        renderDashboard();
        break;
      case 'transactions':
        renderTransactionsView();
        break;
      case 'accounts':
        renderAccountsView();
        break;
      case 'budget':
        renderBudgetView();
        break;
      case 'savings':
        renderSavingsView();
        break;
      case 'income':
        renderIncomeView();
        break;
      case 'investments':
        renderInvestmentsView();
        break;
      case 'debt':
        renderDebtView();
        break;
      case 'reports':
        renderReportsView();
        break;
      case 'settings':
        renderSettingsView();
        break;
    }
  }

  function updateTopIndicators() {
    const summary = calculateFinancialSummary();
    const sidebarNetWorth = document.getElementById('sidebarNetWorth');
    const sidebarUserName = document.getElementById('sidebarUserName');
    const currentDateDisplay = document.getElementById('currentDateDisplay');

    if (sidebarNetWorth) {
      sidebarNetWorth.textContent = formatCurrency(summary.netWorth);
    }
    if (sidebarUserName) {
      sidebarUserName.textContent = state.settings.userName || 'John Doe';
    }
    if (currentDateDisplay) {
      currentDateDisplay.textContent = formatDate(getTodayStr());
    }
  }

  // =========================================================================
  // 7. DASHBOARD VIEW RENDERER
  // =========================================================================
  function renderDashboard() {
    const currentMonth = getCurrentMonthStr();
    const summary = calculateFinancialSummary(currentMonth);

    // 1. KPI Cards
    const kpiTotalBalance = document.getElementById('kpiTotalBalance');
    const kpiAccountCount = document.getElementById('kpiAccountCount');
    const kpiMonthlyIncome = document.getElementById('kpiMonthlyIncome');
    const kpiIncomeCount = document.getElementById('kpiIncomeCount');
    const kpiMonthlyExpense = document.getElementById('kpiMonthlyExpense');
    const kpiExpenseCount = document.getElementById('kpiExpenseCount');
    const kpiNetCashflow = document.getElementById('kpiNetCashflow');
    const kpiSavingsRate = document.getElementById('kpiSavingsRate');

    if (kpiTotalBalance) kpiTotalBalance.textContent = formatCurrency(summary.netLiquidBalance);
    if (kpiAccountCount) kpiAccountCount.textContent = `${state.accounts.length} Akun Aktif`;
    if (kpiMonthlyIncome) kpiMonthlyIncome.textContent = formatCurrency(summary.periodIncome);
    if (kpiIncomeCount) kpiIncomeCount.textContent = `${summary.periodIncomeCount} Transaksi`;
    if (kpiMonthlyExpense) kpiMonthlyExpense.textContent = formatCurrency(summary.periodExpense);
    if (kpiExpenseCount) kpiExpenseCount.textContent = `${summary.periodExpenseCount} Transaksi`;

    if (kpiNetCashflow) {
      kpiNetCashflow.textContent = formatCurrency(summary.netCashflow);
      kpiNetCashflow.className = summary.netCashflow >= 0 ? 'kpi-value text-green' : 'kpi-value text-red';
    }

    if (kpiSavingsRate) {
      kpiSavingsRate.textContent = `${summary.savingsRate.toFixed(1)}%`;
      kpiSavingsRate.className = summary.savingsRate >= 20 ? 'kpi-value text-green' : 'kpi-value text-amber';
    }

    // 2. Charts
    renderCashflowTrendChart();
    renderExpenseDonutChart();

    // 3. Recent Transactions
    renderDashboardRecentTransactions();

    // 4. Budget Mini List
    renderDashboardBudgetList();

    // 5. Savings Goals Mini List
    renderDashboardSavingsList();
  }

  function renderCashflowTrendChart() {
    const canvas = document.getElementById('chartCashflowTrend');
    if (!canvas) return;

    // Build last 6 months list
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        key: ym,
        label: d.toLocaleDateString('id-ID', { month: 'short' })
      });
    }

    const incomeData = [];
    const expenseData = [];
    const netData = [];

    months.forEach(m => {
      let inc = 0;
      let exp = 0;
      state.transactions.forEach(tx => {
        if (getMonthYearStr(tx.date) === m.key) {
          if (tx.type === 'income') inc += Number(tx.amount) || 0;
          if (tx.type === 'expense') exp += Number(tx.amount) || 0;
        }
      });
      incomeData.push(inc);
      expenseData.push(exp);
      netData.push(inc - exp);
    });

    if (chartInstances.cashflowTrend) {
      chartInstances.cashflowTrend.destroy();
    }

    const ctx = canvas.getContext('2d');
    chartInstances.cashflowTrend = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months.map(m => m.label),
        datasets: [
          {
            label: 'Pemasukan',
            data: incomeData,
            backgroundColor: 'rgba(34, 197, 94, 0.7)',
            borderColor: '#22C55E',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Pengeluaran',
            data: expenseData,
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: '#EF4444',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            type: 'line',
            label: 'Net Cashflow',
            data: netData,
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            tension: 0.35,
            fill: false,
            pointBackgroundColor: '#3B82F6'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#8B95A5',
              font: { family: 'Inter', size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#8B95A5', font: { family: 'Inter' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#8B95A5',
              font: { family: 'Inter' },
              callback: function (val) {
                if (val >= 1000000 || val <= -1000000) return (val / 1000000).toFixed(0) + ' Jt';
                return val;
              }
            }
          }
        }
      }
    });
  }

  function renderExpenseDonutChart() {
    const canvas = document.getElementById('chartExpenseDonut');
    if (!canvas) return;

    const currentMonth = getCurrentMonthStr();
    const categoryTotals = {};

    state.transactions.forEach(tx => {
      if (tx.type === 'expense' && getMonthYearStr(tx.date) === currentMonth) {
        const cat = tx.category || 'Lainnya';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(tx.amount) || 0);
      }
    });

    const labels = Object.keys(categoryTotals);
    const data = labels.map(c => categoryTotals[c]);
    const colors = labels.map(c => getCategoryColor(c));

    if (chartInstances.expenseDonut) {
      chartInstances.expenseDonut.destroy();
    }

    const ctx = canvas.getContext('2d');
    if (labels.length === 0) {
      // Empty state donut
      chartInstances.expenseDonut = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Belum Ada Pengeluaran'],
          datasets: [{
            data: [1],
            backgroundColor: ['#272D36'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          },
          cutout: '72%'
        }
      });
      return;
    }

    chartInstances.expenseDonut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderColor: '#161A20',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#8B95A5',
              font: { family: 'Inter', size: 11 },
              boxWidth: 12
            }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const total = data.reduce((a, b) => a + b, 0);
                const percent = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${formatCurrency(ctx.parsed)} (${percent}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  function renderDashboardRecentTransactions() {
    const container = document.getElementById('dashboardRecentTxList');
    if (!container) return;

    const recent = [...state.transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    if (recent.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="inbox"></i>
          <p class="empty-desc">Belum ada transaksi dicatat.</p>
        </div>
      `;
      return;
    }

    let html = '';
    recent.forEach(tx => {
      let icon = 'arrow-up-right';
      let iconBg = 'bg-red-subtle';
      let iconColor = 'text-red';
      let amountClass = 'text-red';
      let prefix = '- ';

      if (tx.type === 'income') {
        icon = 'arrow-down-left';
        iconBg = 'bg-green-subtle';
        iconColor = 'text-green';
        amountClass = 'text-green';
        prefix = '+ ';
      } else if (tx.type === 'transfer') {
        icon = 'repeat';
        iconBg = 'bg-blue-subtle';
        iconColor = 'text-blue';
        amountClass = 'text-blue';
        prefix = '';
      }

      const acc = state.accounts.find(a => a.id === tx.accountId);
      const accName = acc ? acc.name : 'Rekening';

      html += `
        <div class="recent-tx-item">
          <div class="recent-tx-left">
            <div class="recent-tx-icon ${iconBg} ${iconColor}">
              <i data-lucide="${icon}"></i>
            </div>
            <div class="recent-tx-details">
              <span class="recent-tx-desc">${escapeHtml(tx.description)}</span>
              <span class="recent-tx-meta">${formatDate(tx.date)} &bull; ${escapeHtml(tx.category || accName)}</span>
            </div>
          </div>
          <div class="recent-tx-amount ${amountClass}">
            ${prefix}${formatCurrency(tx.amount)}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function renderDashboardBudgetList() {
    const container = document.getElementById('dashboardBudgetList');
    if (!container) return;

    const currentMonth = getCurrentMonthStr();
    const currentBudgets = state.budgets.filter(b => b.month === currentMonth).slice(0, 4);

    if (currentBudgets.length === 0) {
      container.innerHTML = `
        <div class="text-center py-3 text-secondary text-sm">
          Belum ada anggaran untuk bulan ini.
          <div class="mt-3"><a href="#budget" class="btn btn-secondary btn-sm" data-view="budget">+ Buat Anggaran</a></div>
        </div>
      `;
      return;
    }

    let html = '';
    currentBudgets.forEach(bgt => {
      // Calculate spent
      let spent = 0;
      state.transactions.forEach(tx => {
        if (tx.type === 'expense' && tx.category === bgt.category && getMonthYearStr(tx.date) === currentMonth) {
          spent += Number(tx.amount) || 0;
        }
      });

      const budgetAmt = Number(bgt.amount) || 1;
      const pct = Math.min(100, Math.round((spent / budgetAmt) * 100));

      let fillClass = '';
      if (pct >= 100) fillClass = 'danger';
      else if (pct >= 80) fillClass = 'warning';

      html += `
        <div class="mini-budget-item">
          <div class="mini-budget-header">
            <span class="mini-budget-title">${escapeHtml(bgt.category)}</span>
            <span class="mini-budget-vals">${formatCurrency(spent)} / ${formatCurrency(budgetAmt)} (${pct}%)</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill ${fillClass}" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function renderDashboardSavingsList() {
    const container = document.getElementById('dashboardSavingsList');
    if (!container) return;

    const goals = state.savingsGoals.slice(0, 3);
    if (goals.length === 0) {
      container.innerHTML = `
        <div class="text-center py-3 text-secondary text-sm">
          Belum ada target tabungan.
          <div class="mt-3"><a href="#savings" class="btn btn-secondary btn-sm" data-view="savings">+ Buat Target</a></div>
        </div>
      `;
      return;
    }

    let html = '';
    goals.forEach(goal => {
      const cur = Number(goal.currentAmount) || 0;
      const tgt = Number(goal.targetAmount) || 1;
      const pct = Math.min(100, Math.round((cur / tgt) * 100));

      html += `
        <div class="mini-budget-item">
          <div class="mini-budget-header">
            <span class="mini-budget-title">${escapeHtml(goal.title)}</span>
            <span class="text-green font-semibold">${pct}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${pct}%;"></div>
          </div>
          <div class="text-right text-muted text-xs">
            ${formatCurrency(cur)} dari ${formatCurrency(tgt)}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // =========================================================================
  // 8. TRANSACTIONS VIEW
  // =========================================================================
  function renderTransactionsView() {
    populateTransactionFilters();
    filterAndRenderTransactionsTable();
  }

  function populateTransactionFilters() {
    const catSelect = document.getElementById('txFilterCategory');
    const accSelect = document.getElementById('txFilterAccount');
    const monthSelect = document.getElementById('txFilterMonth');

    // Categories
    if (catSelect && catSelect.options.length <= 1) {
      const allCategories = new Set();
      [...DEFAULT_CATEGORIES.income, ...DEFAULT_CATEGORIES.expense].forEach(c => allCategories.add(c));
      state.transactions.forEach(t => { if (t.category) allCategories.add(t.category); });

      catSelect.innerHTML = '<option value="all">Semua Kategori</option>';
      Array.from(allCategories).sort().forEach(cat => {
        catSelect.innerHTML += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
      });
    }

    // Accounts
    if (accSelect) {
      const currentVal = accSelect.value || 'all';
      accSelect.innerHTML = '<option value="all">Semua Akun</option>';
      state.accounts.forEach(acc => {
        accSelect.innerHTML += `<option value="${acc.id}" ${currentVal === acc.id ? 'selected' : ''}>${escapeHtml(acc.name)}</option>`;
      });
    }

    // Months
    if (monthSelect) {
      const monthsSet = new Set();
      monthsSet.add(getCurrentMonthStr());
      state.transactions.forEach(t => {
        if (t.date) monthsSet.add(getMonthYearStr(t.date));
      });

      const sortedMonths = Array.from(monthsSet).sort().reverse();
      const currentVal = monthSelect.value || 'all';

      let options = '<option value="all">Semua Bulan</option>';
      sortedMonths.forEach(m => {
        options += `<option value="${m}" ${currentVal === m ? 'selected' : ''}>${formatMonthLabel(m)}</option>`;
      });
      monthSelect.innerHTML = options;
    }
  }

  function filterAndRenderTransactionsTable() {
    const tbody = document.getElementById('txTableBody');
    const emptyState = document.getElementById('txEmptyState');
    const filteredIncomeEl = document.getElementById('txFilteredIncome');
    const filteredExpenseEl = document.getElementById('txFilteredExpense');
    const filteredNetEl = document.getElementById('txFilteredNet');
    const filteredCountEl = document.getElementById('txFilteredCount');

    if (!tbody) return;

    let filtered = [...state.transactions];

    // Search query
    if (txFilterState.search.trim()) {
      const q = txFilterState.search.toLowerCase();
      filtered = filtered.filter(t =>
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q))
      );
    }

    // Filter Type
    if (txFilterState.type !== 'all') {
      filtered = filtered.filter(t => t.type === txFilterState.type);
    }

    // Filter Category
    if (txFilterState.category !== 'all') {
      filtered = filtered.filter(t => t.category === txFilterState.category);
    }

    // Filter Account
    if (txFilterState.account !== 'all') {
      filtered = filtered.filter(t => t.accountId === txFilterState.account || t.toAccountId === txFilterState.account);
    }

    // Filter Month
    if (txFilterState.month !== 'all') {
      filtered = filtered.filter(t => getMonthYearStr(t.date) === txFilterState.month);
    }

    // Sort by Date descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Stats calculations
    let fIncome = 0;
    let fExpense = 0;
    filtered.forEach(t => {
      if (t.type === 'income') fIncome += Number(t.amount) || 0;
      if (t.type === 'expense') fExpense += Number(t.amount) || 0;
    });
    const fNet = fIncome - fExpense;

    if (filteredIncomeEl) filteredIncomeEl.textContent = formatCurrency(fIncome);
    if (filteredExpenseEl) filteredExpenseEl.textContent = formatCurrency(fExpense);
    if (filteredNetEl) {
      filteredNetEl.textContent = formatCurrency(fNet);
      filteredNetEl.className = fNet >= 0 ? 'tx-stat-val text-green' : 'tx-stat-val text-red';
    }
    if (filteredCountEl) filteredCountEl.textContent = `${filtered.length} Data`;

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    let html = '';
    filtered.forEach(tx => {
      const fromAcc = state.accounts.find(a => a.id === tx.accountId);
      const toAcc = tx.toAccountId ? state.accounts.find(a => a.id === tx.toAccountId) : null;

      let typeBadge = '';
      let amountHtml = '';

      if (tx.type === 'income') {
        typeBadge = '<span class="badge badge-green">Pemasukan</span>';
        amountHtml = `<span class="text-green font-semibold">+ ${formatCurrency(tx.amount)}</span>`;
      } else if (tx.type === 'expense') {
        typeBadge = '<span class="badge badge-red">Pengeluaran</span>';
        amountHtml = `<span class="text-red font-semibold">- ${formatCurrency(tx.amount)}</span>`;
      } else {
        typeBadge = '<span class="badge badge-blue">Transfer</span>';
        amountHtml = `<span class="text-blue font-semibold">${formatCurrency(tx.amount)}</span>`;
      }

      let accountText = fromAcc ? escapeHtml(fromAcc.name) : '-';
      if (tx.type === 'transfer' && toAcc) {
        accountText = `${fromAcc ? escapeHtml(fromAcc.name) : '-'} &rarr; ${escapeHtml(toAcc.name)}`;
      }

      html += `
        <tr>
          <td class="text-secondary" style="white-space: nowrap;">${formatDate(tx.date)}</td>
          <td>
            <div style="font-weight: 600;">${escapeHtml(tx.description)}</div>
            <div class="text-muted" style="font-size: 0.76rem;">
              <span class="badge badge-gray" style="font-size: 0.7rem; padding: 2px 6px;">${escapeHtml(tx.category || 'Umum')}</span>
              ${tx.notes ? `&bull; ${escapeHtml(tx.notes)}` : ''}
            </div>
          </td>
          <td>${accountText}</td>
          <td>${typeBadge}</td>
          <td class="text-right amount-col">${amountHtml}</td>
          <td class="text-center">
            <div class="btn-group" style="justify-content: center; gap: 4px;">
              <button class="btn-icon-sm" title="Edit" onclick="FINANCE_OS.openEditTransaction('${tx.id}')">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="btn-icon-sm" title="Hapus" onclick="FINANCE_OS.confirmDeleteTransaction('${tx.id}')">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================================
  // 9. ACCOUNTS VIEW
  // =========================================================================
  function renderAccountsView() {
    const summary = calculateFinancialSummary();
    const container = document.getElementById('accountsListContainer');
    const accTotalLiquid = document.getElementById('accTotalLiquid');
    const accTotalLiability = document.getElementById('accTotalLiability');
    const accNetLiquid = document.getElementById('accNetLiquid');

    if (accTotalLiquid) accTotalLiquid.textContent = formatCurrency(summary.totalLiquidAssets);
    if (accTotalLiability) accTotalLiability.textContent = formatCurrency(summary.totalLiabilitiesAcc);
    if (accNetLiquid) accNetLiquid.textContent = formatCurrency(summary.netLiquidBalance);

    if (!container) return;

    if (state.accounts.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i data-lucide="wallet"></i>
          <p class="empty-title">Belum ada rekening / dompet</p>
          <p class="empty-desc">Tambahkan rekening bank, dompet digital, atau uang kas Anda.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    let html = '';
    state.accounts.forEach(acc => {
      let typeLabel = 'Rekening Bank';
      let typeBadge = 'badge-blue';
      if (acc.type === 'wallet') { typeLabel = 'E-Wallet'; typeBadge = 'badge-green'; }
      if (acc.type === 'cash') { typeLabel = 'Uang Tunai'; typeBadge = 'badge-gray'; }
      if (acc.type === 'credit') { typeLabel = 'Kartu Kredit / Liabilitas'; typeBadge = 'badge-red'; }
      if (acc.type === 'investment') { typeLabel = 'Akun Investasi'; typeBadge = 'badge-purple'; }

      const balanceFormatted = formatCurrency(acc.balance);
      const isNegative = acc.type === 'credit';

      html += `
        <div class="account-card" style="--card-color: ${acc.color || '#3B82F6'};">
          <div class="acc-card-header">
            <div>
              <div class="acc-card-title">${escapeHtml(acc.name)}</div>
              <div class="acc-card-number">${escapeHtml(acc.number || '-')}</div>
            </div>
            <span class="badge ${typeBadge}">${typeLabel}</span>
          </div>

          <div>
            <div class="text-secondary text-xs mb-1">${isNegative ? 'Tagihan Pemakaian' : 'Saldo Tersedia'}</div>
            <div class="acc-card-balance ${isNegative ? 'text-red' : 'text-primary'}">
              ${isNegative ? '- ' : ''}${balanceFormatted}
            </div>
          </div>

          <div class="acc-card-footer">
            <span class="text-muted text-xs">ID: ${acc.id}</span>
            <div class="btn-group">
              <button class="btn-icon-sm" title="Edit Akun" onclick="FINANCE_OS.openEditAccount('${acc.id}')">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="btn-icon-sm" title="Hapus Akun" onclick="FINANCE_OS.confirmDeleteAccount('${acc.id}')">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================================
  // 10. BUDGET VIEW
  // =========================================================================
  function renderBudgetView() {
    const monthSelect = document.getElementById('budgetMonthSelector');
    const container = document.getElementById('budgetCategoriesContainer');
    const emptyState = document.getElementById('budgetEmptyState');

    // Populate month selector if empty
    if (monthSelect && monthSelect.options.length <= 1) {
      const monthsSet = new Set();
      monthsSet.add(getCurrentMonthStr());
      state.budgets.forEach(b => monthsSet.add(b.month));

      const sorted = Array.from(monthsSet).sort().reverse();
      monthSelect.innerHTML = '';
      sorted.forEach(m => {
        monthSelect.innerHTML += `<option value="${m}">${formatMonthLabel(m)}</option>`;
      });
    }

    const selectedMonth = (monthSelect && monthSelect.value) ? monthSelect.value : getCurrentMonthStr();
    const activeBudgets = state.budgets.filter(b => b.month === selectedMonth);

    // Calculate Macro stats
    let totalBudgeted = 0;
    let totalSpent = 0;

    activeBudgets.forEach(b => {
      totalBudgeted += Number(b.amount) || 0;
      // sum expenses in category & month
      state.transactions.forEach(tx => {
        if (tx.type === 'expense' && tx.category === b.category && getMonthYearStr(tx.date) === selectedMonth) {
          totalSpent += Number(tx.amount) || 0;
        }
      });
    });

    const totalRemaining = totalBudgeted - totalSpent;
    const macroPct = totalBudgeted > 0 ? Math.min(100, Math.round((totalSpent / totalBudgeted) * 100)) : 0;

    document.getElementById('budgetMacroTotal').textContent = formatCurrency(totalBudgeted);
    document.getElementById('budgetMacroSpent').textContent = formatCurrency(totalSpent);
    
    const remEl = document.getElementById('budgetMacroRemaining');
    if (remEl) {
      remEl.textContent = formatCurrency(totalRemaining);
      remEl.className = totalRemaining >= 0 ? 'macro-val text-green' : 'macro-val text-red';
    }

    const pctEl = document.getElementById('budgetMacroPercentage');
    if (pctEl) {
      pctEl.textContent = `${macroPct}%`;
    }

    const macroBar = document.getElementById('budgetMacroProgressBar');
    if (macroBar) {
      macroBar.style.width = `${macroPct}%`;
      macroBar.className = macroPct >= 100 ? 'progress-bar-fill danger' : (macroPct >= 80 ? 'progress-bar-fill warning' : 'progress-bar-fill');
    }

    if (!container) return;

    if (activeBudgets.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    let html = '';
    activeBudgets.forEach(bgt => {
      let spent = 0;
      state.transactions.forEach(tx => {
        if (tx.type === 'expense' && tx.category === bgt.category && getMonthYearStr(tx.date) === selectedMonth) {
          spent += Number(tx.amount) || 0;
        }
      });

      const budgetAmt = Number(bgt.amount) || 1;
      const remaining = budgetAmt - spent;
      const pct = Math.round((spent / budgetAmt) * 100);

      let statusBadge = '<span class="badge badge-green">Aman</span>';
      let fillClass = '';
      if (pct >= 100) {
        statusBadge = '<span class="badge badge-red">Overbudget!</span>';
        fillClass = 'danger';
      } else if (pct >= 80) {
        statusBadge = '<span class="badge badge-amber">Mendekati Batas</span>';
        fillClass = 'warning';
      }

      html += `
        <div class="budget-card">
          <div class="budget-card-header">
            <div>
              <div class="budget-category-name">${escapeHtml(bgt.category)}</div>
              <div class="text-muted text-xs">${formatMonthLabel(bgt.month)}</div>
            </div>
            ${statusBadge}
          </div>

          <div class="budget-amounts">
            <div>
              <span class="text-secondary text-xs">Terpakai:</span>
              <div class="font-bold">${formatCurrency(spent)}</div>
            </div>
            <div class="text-right">
              <span class="text-secondary text-xs">Batas Anggaran:</span>
              <div class="font-semibold text-secondary">${formatCurrency(budgetAmt)}</div>
            </div>
          </div>

          <div class="progress-bar-bg">
            <div class="progress-bar-fill ${fillClass}" style="width: ${Math.min(100, pct)}%;"></div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 10px;">
            <span class="text-xs ${remaining >= 0 ? 'text-green' : 'text-red'} font-semibold">
              ${remaining >= 0 ? `Sisa: ${formatCurrency(remaining)}` : `Lebih: ${formatCurrency(Math.abs(remaining))}`}
            </span>
            <div class="btn-group">
              <button class="btn-icon-sm" title="Edit Anggaran" onclick="FINANCE_OS.openEditBudget('${bgt.id}')">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="btn-icon-sm" title="Hapus Anggaran" onclick="FINANCE_OS.confirmDeleteBudget('${bgt.id}')">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================================
  // 11. SAVINGS GOALS VIEW
  // =========================================================================
  function renderSavingsView() {
    const container = document.getElementById('savingsGoalsContainer');
    const emptyState = document.getElementById('savingsEmptyState');
    const totalSavedEl = document.getElementById('savingsTotalSaved');
    const totalTargetEl = document.getElementById('savingsTotalTarget');
    const avgProgressEl = document.getElementById('savingsAvgProgress');

    let totalSaved = 0;
    let totalTarget = 0;

    state.savingsGoals.forEach(g => {
      totalSaved += Number(g.currentAmount) || 0;
      totalTarget += Number(g.targetAmount) || 0;
    });

    const avgProgress = totalTarget > 0 ? ((totalSaved / totalTarget) * 100).toFixed(1) : 0;

    if (totalSavedEl) totalSavedEl.textContent = formatCurrency(totalSaved);
    if (totalTargetEl) totalTargetEl.textContent = formatCurrency(totalTarget);
    if (avgProgressEl) avgProgressEl.textContent = `${avgProgress}%`;

    if (!container) return;

    if (state.savingsGoals.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    let html = '';
    state.savingsGoals.forEach(goal => {
      const cur = Number(goal.currentAmount) || 0;
      const tgt = Number(goal.targetAmount) || 1;
      const pct = Math.min(100, Math.round((cur / tgt) * 100));
      const remaining = Math.max(0, tgt - cur);

      let statusBadge = '<span class="badge badge-blue">Dalam Progres</span>';
      if (cur >= tgt) {
        statusBadge = '<span class="badge badge-green">Tercapai 🎉</span>';
      } else if (pct >= 80) {
        statusBadge = '<span class="badge badge-amber">Hampir Tercapai</span>';
      }

      html += `
        <div class="savings-card">
          <div class="savings-card-top">
            <div>
              <div class="savings-card-title">${escapeHtml(goal.title)}</div>
              <div class="savings-card-category">${escapeHtml(goal.category || 'Tabungan')}</div>
            </div>
            ${statusBadge}
          </div>

          <div>
            <div class="savings-progress-numbers">
              <span class="savings-current-val">${formatCurrency(cur)}</span>
              <span class="savings-target-val">dari ${formatCurrency(tgt)}</span>
            </div>
            <div class="progress-bar-bg mt-2">
              <div class="progress-bar-fill" style="width: ${pct}%;"></div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-secondary);">
            <span>Sisa: <b>${formatCurrency(remaining)}</b></span>
            <span>Tenggat: <b>${formatDate(goal.deadline)}</b></span>
          </div>

          <div class="savings-card-actions">
            <button class="btn btn-secondary btn-sm" onclick="FINANCE_OS.openSavingsDepositModal('${goal.id}')">
              <i data-lucide="plus-circle"></i>
              <span>+ Setoran</span>
            </button>
            <div class="btn-group">
              <button class="btn-icon-sm" title="Edit Target" onclick="FINANCE_OS.openEditSavingsGoal('${goal.id}')">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="btn-icon-sm" title="Hapus Target" onclick="FINANCE_OS.confirmDeleteSavingsGoal('${goal.id}')">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================================
  // 12. INCOME TRACKING VIEW
  // =========================================================================
  function renderIncomeView() {
    const tbody = document.getElementById('incomeTableBody');
    const emptyState = document.getElementById('incomeEmptyState');
    const kpiReceived = document.getElementById('incomeKpiReceived');
    const kpiPending = document.getElementById('incomeKpiPending');
    const kpiTotalExpected = document.getElementById('incomeKpiTotalExpected');

    let totalReceived = 0;
    let totalPending = 0;

    state.incomes.forEach(inc => {
      const amt = Number(inc.amount) || 0;
      if (inc.status === 'received') {
        totalReceived += amt;
      } else {
        totalPending += amt;
      }
    });

    if (kpiReceived) kpiReceived.textContent = formatCurrency(totalReceived);
    if (kpiPending) kpiPending.textContent = formatCurrency(totalPending);
    if (kpiTotalExpected) kpiTotalExpected.textContent = formatCurrency(totalReceived + totalPending);

    if (!tbody) return;

    let filtered = [...state.incomes];
    if (activeIncomeTab === 'pending') {
      filtered = filtered.filter(i => i.status === 'pending');
    } else if (activeIncomeTab === 'received') {
      filtered = filtered.filter(i => i.status === 'received');
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    let html = '';
    filtered.forEach(inc => {
      const isReceived = inc.status === 'received';
      const statusBadge = isReceived
        ? '<span class="badge badge-green">Diterima</span>'
        : '<span class="badge badge-amber">Menunggu Pembayaran</span>';

      html += `
        <tr>
          <td>
            <div class="font-semibold">${escapeHtml(inc.source)}</div>
          </td>
          <td>
            <span class="badge badge-gray">${escapeHtml(inc.type || 'Lainnya')}</span>
          </td>
          <td class="text-secondary">${formatDate(inc.dueDate)}</td>
          <td class="amount-col font-bold text-green">${formatCurrency(inc.amount)}</td>
          <td>${statusBadge}</td>
          <td class="text-center">
            <div class="btn-group" style="justify-content: center; gap: 4px;">
              ${!isReceived ? `
                <button class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.74rem;" onclick="FINANCE_OS.markIncomeReceived('${inc.id}')" title="Tandai Sudah Diterima">
                  <i data-lucide="check-circle" class="text-green"></i>
                  <span>Cairkan</span>
                </button>
              ` : ''}
              <button class="btn-icon-sm" title="Edit" onclick="FINANCE_OS.openEditIncome('${inc.id}')">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="btn-icon-sm" title="Hapus" onclick="FINANCE_OS.confirmDeleteIncome('${inc.id}')">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================================
  // 13. INVESTMENTS VIEW
  // =========================================================================
  function renderInvestmentsView() {
    const summary = calculateFinancialSummary();
    const tbody = document.getElementById('investmentsTableBody');
    const emptyState = document.getElementById('investmentsEmptyState');

    const invTotalValue = document.getElementById('invTotalValue');
    const invTotalInvested = document.getElementById('invTotalInvested');
    const invTotalProfitLoss = document.getElementById('invTotalProfitLoss');
    const invProfitLossBadge = document.getElementById('invProfitLossBadge');

    if (invTotalValue) invTotalValue.textContent = formatCurrency(summary.totalInvestmentMarketValue);
    if (invTotalInvested) invTotalInvested.textContent = formatCurrency(summary.totalInvested);

    if (invTotalProfitLoss) {
      const pl = summary.investmentProfitLoss;
      invTotalProfitLoss.textContent = formatCurrency(pl);
      invTotalProfitLoss.className = pl >= 0 ? 'kpi-value text-green' : 'kpi-value text-red';
    }

    if (invProfitLossBadge) {
      const pl = summary.investmentProfitLoss;
      const plPct = summary.totalInvested > 0 ? ((pl / summary.totalInvested) * 100).toFixed(2) : 0;
      invProfitLossBadge.textContent = `${pl >= 0 ? '+' : ''}${plPct}% Unrealized P/L`;
      invProfitLossBadge.className = pl >= 0 ? 'kpi-footer text-green' : 'kpi-footer text-red';
    }

    renderInvestmentAllocationChart();
    renderInvestmentPerformanceChart();

    if (!tbody) return;

    if (state.investments.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    let html = '';
    state.investments.forEach(inv => {
      const qty = Number(inv.quantity) || 0;
      const buyPrice = Number(inv.buyPrice) || 0;
      const curPrice = Number(inv.currentPrice) || 0;

      const totalMarket = qty * curPrice;
      const totalCost = qty * buyPrice;
      const pl = totalMarket - totalCost;
      const plPct = totalCost > 0 ? ((pl / totalCost) * 100).toFixed(2) : 0;

      html += `
        <tr>
          <td>
            <div class="font-bold">${escapeHtml(inv.name)}</div>
          </td>
          <td>
            <span class="badge badge-purple">${escapeHtml(inv.type || 'Aset')}</span>
          </td>
          <td class="text-right font-mono">${qty.toLocaleString('id-ID')}</td>
          <td class="text-right">${formatCurrency(buyPrice)}</td>
          <td class="text-right font-semibold">${formatCurrency(curPrice)}</td>
          <td class="text-right font-bold text-blue">${formatCurrency(totalMarket)}</td>
          <td class="text-right ${pl >= 0 ? 'text-green' : 'text-red'} font-semibold">
            ${pl >= 0 ? '+' : ''}${formatCurrency(pl)} (${plPct}%)
          </td>
          <td class="text-center">
            <div class="btn-group" style="justify-content: center; gap: 4px;">
              <button class="btn-icon-sm" title="Perbarui Harga Pasar" onclick="FINANCE_OS.openUpdatePriceModal('${inv.id}')">
                <i data-lucide="trending-up"></i>
              </button>
              <button class="btn-icon-sm" title="Edit Aset" onclick="FINANCE_OS.openEditAsset('${inv.id}')">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="btn-icon-sm" title="Hapus Aset" onclick="FINANCE_OS.confirmDeleteAsset('${inv.id}')">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  function renderInvestmentAllocationChart() {
    const canvas = document.getElementById('chartInvestmentAllocation');
    if (!canvas) return;

    const allocation = {};
    state.investments.forEach(inv => {
      const type = inv.type || 'Lainnya';
      const val = (Number(inv.quantity) || 0) * (Number(inv.currentPrice) || 0);
      allocation[type] = (allocation[type] || 0) + val;
    });

    const labels = Object.keys(allocation);
    const data = labels.map(l => allocation[l]);
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B'];

    if (chartInstances.investAllocation) chartInstances.investAllocation.destroy();

    const ctx = canvas.getContext('2d');
    if (labels.length === 0) {
      chartInstances.investAllocation = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Belum Ada Portofolio'],
          datasets: [{ data: [1], backgroundColor: ['#272D36'], borderWidth: 0 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          cutout: '70%'
        }
      });
      return;
    }

    chartInstances.investAllocation = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: '#161A20',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#8B95A5', font: { family: 'Inter', size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const total = data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${formatCurrency(ctx.parsed)} (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  function renderInvestmentPerformanceChart() {
    const canvas = document.getElementById('chartInvestmentPerformance');
    if (!canvas) return;

    const assets = state.investments.slice(0, 5);
    const labels = assets.map(a => a.name.split(' ')[0]);
    const costData = assets.map(a => (Number(a.quantity) || 0) * (Number(a.buyPrice) || 0));
    const marketData = assets.map(a => (Number(a.quantity) || 0) * (Number(a.currentPrice) || 0));

    if (chartInstances.investPerformance) chartInstances.investPerformance.destroy();

    const ctx = canvas.getContext('2d');
    chartInstances.investPerformance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Modal Beli',
            data: costData,
            backgroundColor: 'rgba(100, 116, 139, 0.7)',
            borderColor: '#64748B',
            borderRadius: 4
          },
          {
            label: 'Valuasi Pasar',
            data: marketData,
            backgroundColor: 'rgba(59, 130, 246, 0.75)',
            borderColor: '#3B82F6',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#8B95A5', font: { family: 'Inter', size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#8B95A5', font: { family: 'Inter' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#8B95A5',
              font: { family: 'Inter' },
              callback: function (val) {
                if (val >= 1000000) return (val / 1000000).toFixed(0) + ' Jt';
                return val;
              }
            }
          }
        }
      }
    });
  }

  // =========================================================================
  // 14. DEBT MANAGEMENT VIEW
  // =========================================================================
  function renderDebtView() {
    const summary = calculateFinancialSummary();
    const container = document.getElementById('debtCardsContainer');
    const emptyState = document.getElementById('debtEmptyState');

    const debtTotalPayable = document.getElementById('debtTotalPayable');
    const debtTotalReceivable = document.getElementById('debtTotalReceivable');
    const debtNetPosition = document.getElementById('debtNetPosition');

    if (debtTotalPayable) debtTotalPayable.textContent = formatCurrency(summary.totalOutstandingPayable);
    if (debtTotalReceivable) debtTotalReceivable.textContent = formatCurrency(summary.totalOutstandingReceivable);

    if (debtNetPosition) {
      const netPos = summary.totalOutstandingReceivable - summary.totalOutstandingPayable;
      debtNetPosition.textContent = formatCurrency(netPos);
      debtNetPosition.className = netPos >= 0 ? 'kpi-value text-green' : 'kpi-value text-red';
    }

    if (!container) return;

    let filtered = [...state.debts];
    if (activeDebtTab === 'payable') {
      filtered = filtered.filter(d => d.type === 'payable');
    } else if (activeDebtTab === 'receivable') {
      filtered = filtered.filter(d => d.type === 'receivable');
    }

    if (filtered.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    let html = '';
    filtered.forEach(debt => {
      const isPayable = debt.type === 'payable';
      const total = Number(debt.totalAmount) || 0;
      const paid = Number(debt.paidAmount) || 0;
      const remaining = Math.max(0, total - paid);
      const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

      let statusBadge = '<span class="badge badge-amber">Belum Lunas</span>';
      if (remaining === 0) {
        statusBadge = '<span class="badge badge-green">Lunas</span>';
      } else if (paid > 0) {
        statusBadge = '<span class="badge badge-blue">Dicicil Sebagian</span>';
      }

      html += `
        <div class="debt-card">
          <div class="debt-card-header">
            <div>
              <div class="debt-counterparty">${escapeHtml(debt.counterparty)}</div>
              <div class="text-muted text-xs">${isPayable ? 'Utang Kewajiban' : 'Piutang Dipinjamkan'}</div>
            </div>
            ${statusBadge}
          </div>

          <div>
            <div class="debt-amount-row">
              <div>
                <span class="text-secondary text-xs">Sisa Belum Lunas:</span>
                <div class="debt-remaining-val ${isPayable ? 'text-red' : 'text-green'}">
                  ${formatCurrency(remaining)}
                </div>
              </div>
              <div class="text-right">
                <span class="text-secondary text-xs">Total Pinjaman:</span>
                <div class="font-semibold text-secondary">${formatCurrency(total)}</div>
              </div>
            </div>

            <div class="progress-bar-bg mt-3">
              <div class="progress-bar-fill" style="width: ${pct}%;"></div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-secondary);">
            <span>Jatuh Tempo: <b>${formatDate(debt.dueDate)}</b></span>
            <span>Terbayar: <b>${pct}%</b></span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 12px;">
            ${remaining > 0 ? `
              <button class="btn btn-secondary btn-sm" onclick="FINANCE_OS.openDebtPaymentModal('${debt.id}')">
                <i data-lucide="check"></i>
                <span>${isPayable ? 'Bayar Cicilan' : 'Terima Pembayaran'}</span>
              </button>
            ` : '<span class="text-xs text-green font-semibold">Pelunasan Lengkap</span>'}

            <div class="btn-group">
              <button class="btn-icon-sm" title="Edit" onclick="FINANCE_OS.openEditDebt('${debt.id}')">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="btn-icon-sm" title="Hapus" onclick="FINANCE_OS.confirmDeleteDebt('${debt.id}')">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================================
  // 15. REPORTS VIEW
  // =========================================================================
  function renderReportsView() {
    const summary = calculateFinancialSummary();

    // Net worth banner
    const repNetWorth = document.getElementById('repNetWorth');
    const repTotalAssets = document.getElementById('repTotalAssets');
    const repTotalLiabilities = document.getElementById('repTotalLiabilities');
    const repDebtToAssetRatio = document.getElementById('repDebtToAssetRatio');

    if (repNetWorth) repNetWorth.textContent = formatCurrency(summary.netWorth);
    if (repTotalAssets) repTotalAssets.textContent = formatCurrency(summary.totalAssets);
    if (repTotalLiabilities) repTotalLiabilities.textContent = formatCurrency(summary.totalLiabilities);

    if (repDebtToAssetRatio) {
      const ratio = summary.totalAssets > 0 ? ((summary.totalLiabilities / summary.totalAssets) * 100).toFixed(1) : 0;
      repDebtToAssetRatio.textContent = `${ratio}%`;
    }

    renderReportsIncomeExpenseChart();
    renderReportsCategoryBarChart();
    renderReportsScorecardTable(summary);
  }

  function renderReportsIncomeExpenseChart() {
    const canvas = document.getElementById('chartReportIncomeExpense');
    if (!canvas) return;

    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key: ym, label: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }) });
    }

    const incs = [];
    const exps = [];

    months.forEach(m => {
      let iVal = 0;
      let eVal = 0;
      state.transactions.forEach(tx => {
        if (getMonthYearStr(tx.date) === m.key) {
          if (tx.type === 'income') iVal += Number(tx.amount) || 0;
          if (tx.type === 'expense') eVal += Number(tx.amount) || 0;
        }
      });
      incs.push(iVal);
      exps.push(eVal);
    });

    if (chartInstances.reportIncExp) chartInstances.reportIncExp.destroy();

    const ctx = canvas.getContext('2d');
    chartInstances.reportIncExp = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months.map(m => m.label),
        datasets: [
          {
            label: 'Pemasukan',
            data: incs,
            backgroundColor: '#22C55E',
            borderRadius: 4
          },
          {
            label: 'Pengeluaran',
            data: exps,
            backgroundColor: '#EF4444',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#8B95A5', font: { family: 'Inter' } } },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.04)' }, ticks: { color: '#8B95A5' } },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#8B95A5',
              callback: val => (val >= 1000000 ? (val / 1000000).toFixed(0) + ' Jt' : val)
            }
          }
        }
      }
    });
  }

  function renderReportsCategoryBarChart() {
    const canvas = document.getElementById('chartReportCategoryBar');
    if (!canvas) return;

    const catTotals = {};
    state.transactions.forEach(tx => {
      if (tx.type === 'expense') {
        const c = tx.category || 'Lainnya';
        catTotals[c] = (catTotals[c] || 0) + (Number(tx.amount) || 0);
      }
    });

    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labels = sortedCats.map(x => x[0]);
    const data = sortedCats.map(x => x[1]);

    if (chartInstances.reportCatBar) chartInstances.reportCatBar.destroy();

    const ctx = canvas.getContext('2d');
    chartInstances.reportCatBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Pengeluaran',
          data: data,
          backgroundColor: '#8B5CF6',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` Total: ${formatCurrency(ctx.parsed.x)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#8B95A5',
              callback: val => (val >= 1000000 ? (val / 1000000).toFixed(0) + ' Jt' : val)
            }
          },
          y: { grid: { display: false }, ticks: { color: '#8B95A5' } }
        }
      }
    });
  }

  function renderReportsScorecardTable(summary) {
    const tbody = document.getElementById('reportMetricsTableBody');
    if (!tbody) return;

    // 1. Savings Rate
    const sr = summary.savingsRate;
    let srBadge = '<span class="badge badge-green">Sangat Baik</span>';
    if (sr < 10) srBadge = '<span class="badge badge-red">Perlu Ditingkatkan</span>';
    else if (sr < 20) srBadge = '<span class="badge badge-amber">Cukup Baik</span>';

    // 2. Debt to Asset Ratio
    const dar = summary.totalAssets > 0 ? (summary.totalLiabilities / summary.totalAssets) * 100 : 0;
    let darBadge = '<span class="badge badge-green">Sehat (&le; 30%)</span>';
    if (dar > 50) darBadge = '<span class="badge badge-red">Tinggi / Waspada</span>';
    else if (dar > 30) darBadge = '<span class="badge badge-amber">Sedang</span>';

    // 3. Emergency Fund Coverage (Emergency fund vs monthly expense)
    const monthlyExp = summary.periodExpense || 1;
    const emergencyFundGoal = state.savingsGoals.find(g => g.category === 'Dana Darurat');
    const emergencyFundAmount = emergencyFundGoal ? Number(emergencyFundGoal.currentAmount) : 0;
    const monthsCovered = (emergencyFundAmount / monthlyExp).toFixed(1);

    let efBadge = '<span class="badge badge-green">Aman (&ge; 6 Bulan)</span>';
    if (monthsCovered < 3) efBadge = '<span class="badge badge-red">Kurang (&lt; 3 Bulan)</span>';
    else if (monthsCovered < 6) efBadge = '<span class="badge badge-amber">Mencukupi</span>';

    tbody.innerHTML = `
      <tr>
        <td><b>Rasio Tabungan (Savings Rate)</b></td>
        <td class="font-mono font-bold">${sr.toFixed(1)}%</td>
        <td class="text-secondary">&ge; 20% dari total pemasukan</td>
        <td>${srBadge}</td>
      </tr>
      <tr>
        <td><b>Rasio Utang terhadap Aset (Debt-to-Asset)</b></td>
        <td class="font-mono font-bold">${dar.toFixed(1)}%</td>
        <td class="text-secondary">&le; 30% dari total aset bersih</td>
        <td>${darBadge}</td>
      </tr>
      <tr>
        <td><b>Daya Lindung Dana Darurat</b></td>
        <td class="font-mono font-bold">${monthsCovered} Bulan Pengeluaran</td>
        <td class="text-secondary">Minimal 3 - 6 Bulan Pengeluaran</td>
        <td>${efBadge}</td>
      </tr>
      <tr>
        <td><b>Arus Kas Operasional Bulan Ini</b></td>
        <td class="font-mono font-bold ${summary.netCashflow >= 0 ? 'text-green' : 'text-red'}">
          ${formatCurrency(summary.netCashflow)}
        </td>
        <td class="text-secondary">Selalu bernilai positif (Surplus)</td>
        <td>${summary.netCashflow >= 0 ? '<span class="badge badge-green">Surplus</span>' : '<span class="badge badge-red">Defisit</span>'}</td>
      </tr>
    `;
  }

  function exportTransactionsCSV() {
    if (state.transactions.length === 0) {
      showToast('Tidak ada transaksi untuk diekspor', 'error');
      return;
    }

    const headers = ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Deskripsi', 'Nominal', 'Rekening Sumber', 'Rekening Tujuan', 'Catatan'];
    const rows = state.transactions.map(tx => {
      const fromAcc = state.accounts.find(a => a.id === tx.accountId);
      const toAcc = tx.toAccountId ? state.accounts.find(a => a.id === tx.toAccountId) : null;
      return [
        tx.id,
        tx.date,
        tx.type,
        `"${(tx.category || '').replace(/"/g, '""')}"`,
        `"${(tx.description || '').replace(/"/g, '""')}"`,
        tx.amount,
        `"${fromAcc ? fromAcc.name : ''}"`,
        `"${toAcc ? toAcc.name : ''}"`,
        `"${(tx.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `FINANCE_OS_TRANSACTIONS_${getTodayStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('File CSV berhasil diunduh');
  }

  // =========================================================================
  // 16. SETTINGS VIEW & DATA MANAGEMENT
  // =========================================================================
  function renderSettingsView() {
    const nameInput = document.getElementById('setUserName');
    const currInput = document.getElementById('setCurrency');
    const dateInput = document.getElementById('setDateFormat');

    if (nameInput) nameInput.value = state.settings.userName || 'John Doe';
    if (currInput) currInput.value = state.settings.currency || 'IDR';
    if (dateInput) dateInput.value = state.settings.dateFormat || 'id-ID';
  }

  function exportBackupJSON() {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `FINANCE_OS_BACKUP_${getTodayStr()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Cadangan data JSON berhasil diekspor');
  }

  function importBackupJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed && parsed.accounts && parsed.transactions) {
          state = parsed;
          saveState();
          showToast('Data berhasil dipulihkan dari file JSON!');
          renderActiveView(window.location.hash.replace('#', '') || 'dashboard');
        } else {
          showToast('Format file JSON tidak valid untuk FINANCE OS', 'error');
        }
      } catch (err) {
        showToast('Gagal membaca file JSON cadangan', 'error');
      }
    };
    reader.readAsText(file);
  }

  // =========================================================================
  // 17. MODALS SYSTEM
  // =========================================================================
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  function initModals() {
    // Backdrop clicks & close buttons
    document.addEventListener('click', function (e) {
      const closeBtn = e.target.closest('[data-close-modal]');
      if (closeBtn) {
        const modalId = closeBtn.getAttribute('data-close-modal');
        closeModal(modalId);
      } else if (e.target.classList.contains('modal-backdrop')) {
        e.target.classList.remove('active');
      }
    });

    // ESC key closes top active modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-backdrop.active');
        if (activeModal) activeModal.classList.remove('active');
      }
    });
  }

  // =========================================================================
  // 18. CRUD HANDLERS FOR TRANSACTION MODAL
  // =========================================================================
  function populateTransactionModalSelects() {
    const accSelect = document.getElementById('txAccount');
    const toAccSelect = document.getElementById('txToAccount');
    const catSelect = document.getElementById('txCategory');

    // Accounts
    let accHtml = '';
    state.accounts.forEach(acc => {
      accHtml += `<option value="${acc.id}">${escapeHtml(acc.name)} (${formatCurrency(acc.balance)})</option>`;
    });
    if (accSelect) accSelect.innerHTML = accHtml;
    if (toAccSelect) toAccSelect.innerHTML = accHtml;

    // Categories based on current type
    updateTransactionModalCategories();
  }

  function updateTransactionModalCategories() {
    const catSelect = document.getElementById('txCategory');
    if (!catSelect) return;

    let categories = DEFAULT_CATEGORIES.expense;
    if (currentTxType === 'income') {
      categories = DEFAULT_CATEGORIES.income;
    } else if (currentTxType === 'transfer') {
      categories = ['Transfer Antar Akun'];
    }

    catSelect.innerHTML = categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function setTransactionModalType(type) {
    currentTxType = type;
    const typeBtns = document.querySelectorAll('.tx-type-btn');
    typeBtns.forEach(btn => {
      if (btn.dataset.txType === type) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const catGroup = document.getElementById('txCategoryGroup');
    const toAccGroup = document.getElementById('txToAccountGroup');
    const accLabel = document.getElementById('txAccountLabel');

    if (type === 'transfer') {
      if (catGroup) catGroup.classList.add('hidden');
      if (toAccGroup) toAccGroup.classList.remove('hidden');
      if (accLabel) accLabel.textContent = 'Dari Rekening *';
    } else {
      if (catGroup) catGroup.classList.remove('hidden');
      if (toAccGroup) toAccGroup.classList.add('hidden');
      if (accLabel) accLabel.textContent = 'Rekening / Dompet *';
      updateTransactionModalCategories();
    }
  }

  function openAddTransactionModal(presetType = 'expense') {
    document.getElementById('txEditId').value = '';
    document.getElementById('modalTxTitle').textContent = 'Catat Transaksi Baru';
    document.getElementById('formTransaction').reset();
    document.getElementById('txDate').value = getTodayStr();

    populateTransactionModalSelects();
    setTransactionModalType(presetType);
    openModal('modalTransaction');
  }

  function openEditTransaction(txId) {
    const tx = state.transactions.find(t => t.id === txId);
    if (!tx) return;

    populateTransactionModalSelects();
    document.getElementById('txEditId').value = tx.id;
    document.getElementById('modalTxTitle').textContent = 'Edit Transaksi';
    document.getElementById('txAmount').value = tx.amount;
    document.getElementById('txDate').value = tx.date;
    document.getElementById('txDescription').value = tx.description;
    document.getElementById('txNotes').value = tx.notes || '';

    setTransactionModalType(tx.type);

    const accSelect = document.getElementById('txAccount');
    if (accSelect) accSelect.value = tx.accountId;

    if (tx.type === 'transfer') {
      const toAccSelect = document.getElementById('txToAccount');
      if (toAccSelect) toAccSelect.value = tx.toAccountId || '';
    } else {
      const catSelect = document.getElementById('txCategory');
      if (catSelect) catSelect.value = tx.category;
    }

    openModal('modalTransaction');
  }

  function saveTransaction(e) {
    e.preventDefault();
    const editId = document.getElementById('txEditId').value;
    const amount = Number(document.getElementById('txAmount').value);
    const date = document.getElementById('txDate').value;
    const desc = document.getElementById('txDescription').value.trim();
    const notes = document.getElementById('txNotes').value.trim();
    const accountId = document.getElementById('txAccount').value;
    const toAccountId = document.getElementById('txToAccount').value;
    const category = currentTxType === 'transfer' ? 'Transfer Antar Akun' : document.getElementById('txCategory').value;

    if (!amount || amount <= 0) {
      showToast('Masukkan nominal transaksi yang valid', 'error');
      return;
    }

    if (currentTxType === 'transfer' && accountId === toAccountId) {
      showToast('Rekening asal dan tujuan tidak boleh sama', 'error');
      return;
    }

    // If editing, reverse old transaction impact first
    if (editId) {
      const oldTx = state.transactions.find(t => t.id === editId);
      if (oldTx) reverseTransactionImpact(oldTx);
    }

    const txData = {
      id: editId || generateId('tx'),
      type: currentTxType,
      amount: amount,
      date: date,
      category: category,
      accountId: accountId,
      toAccountId: currentTxType === 'transfer' ? toAccountId : null,
      description: desc,
      notes: notes
    };

    // Apply account balance impact
    applyTransactionImpact(txData);

    if (editId) {
      const idx = state.transactions.findIndex(t => t.id === editId);
      if (idx !== -1) state.transactions[idx] = txData;
      showToast('Transaksi berhasil diperbarui');
    } else {
      state.transactions.unshift(txData);
      showToast('Transaksi baru berhasil dicatat');
    }

    saveState();
    closeModal('modalTransaction');
    renderActiveView(window.location.hash.replace('#', '') || 'dashboard');
  }

  function applyTransactionImpact(tx) {
    const fromAcc = state.accounts.find(a => a.id === tx.accountId);
    const toAcc = tx.toAccountId ? state.accounts.find(a => a.id === tx.toAccountId) : null;
    const amt = Number(tx.amount) || 0;

    if (tx.type === 'income' && fromAcc) {
      fromAcc.balance = (Number(fromAcc.balance) || 0) + amt;
    } else if (tx.type === 'expense' && fromAcc) {
      fromAcc.balance = (Number(fromAcc.balance) || 0) - amt;
    } else if (tx.type === 'transfer') {
      if (fromAcc) fromAcc.balance = (Number(fromAcc.balance) || 0) - amt;
      if (toAcc) toAcc.balance = (Number(toAcc.balance) || 0) + amt;
    }
  }

  function reverseTransactionImpact(tx) {
    const fromAcc = state.accounts.find(a => a.id === tx.accountId);
    const toAcc = tx.toAccountId ? state.accounts.find(a => a.id === tx.toAccountId) : null;
    const amt = Number(tx.amount) || 0;

    if (tx.type === 'income' && fromAcc) {
      fromAcc.balance = (Number(fromAcc.balance) || 0) - amt;
    } else if (tx.type === 'expense' && fromAcc) {
      fromAcc.balance = (Number(fromAcc.balance) || 0) + amt;
    } else if (tx.type === 'transfer') {
      if (fromAcc) fromAcc.balance = (Number(fromAcc.balance) || 0) + amt;
      if (toAcc) toAcc.balance = (Number(toAcc.balance) || 0) - amt;
    }
  }

  function confirmDeleteTransaction(txId) {
    openConfirmDialog(
      'Hapus Transaksi',
      'Apakah Anda yakin ingin menghapus catatan transaksi ini? Saldo rekening terkait akan disesuaikan kembali.',
      function () {
        const tx = state.transactions.find(t => t.id === txId);
        if (tx) {
          reverseTransactionImpact(tx);
          state.transactions = state.transactions.filter(t => t.id !== txId);
          saveState();
          showToast('Transaksi telah dihapus');
          renderActiveView(window.location.hash.replace('#', '') || 'dashboard');
        }
      }
    );
  }

  // =========================================================================
  // 19. CRUD HANDLERS FOR ACCOUNTS
  // =========================================================================
  function openAddAccountModal() {
    document.getElementById('accEditId').value = '';
    document.getElementById('modalAccountTitle').textContent = 'Tambah Rekening Baru';
    document.getElementById('formAccount').reset();
    openModal('modalAccount');
  }

  function openEditAccount(accId) {
    const acc = state.accounts.find(a => a.id === accId);
    if (!acc) return;

    document.getElementById('accEditId').value = acc.id;
    document.getElementById('modalAccountTitle').textContent = 'Edit Rekening';
    document.getElementById('accName').value = acc.name;
    document.getElementById('accType').value = acc.type;
    document.getElementById('accBalance').value = acc.balance;
    document.getElementById('accNumber').value = acc.number || '';

    const colorRadio = document.querySelector(`input[name="accColor"][value="${acc.color}"]`);
    if (colorRadio) colorRadio.checked = true;

    openModal('modalAccount');
  }

  function saveAccount(e) {
    e.preventDefault();
    const editId = document.getElementById('accEditId').value;
    const name = document.getElementById('accName').value.trim();
    const type = document.getElementById('accType').value;
    const balance = Number(document.getElementById('accBalance').value) || 0;
    const number = document.getElementById('accNumber').value.trim();
    const colorRadio = document.querySelector('input[name="accColor"]:checked');
    const color = colorRadio ? colorRadio.value : '#3B82F6';

    if (!name) {
      showToast('Nama rekening tidak boleh kosong', 'error');
      return;
    }

    if (editId) {
      const idx = state.accounts.findIndex(a => a.id === editId);
      if (idx !== -1) {
        state.accounts[idx].name = name;
        state.accounts[idx].type = type;
        state.accounts[idx].balance = balance;
        state.accounts[idx].number = number;
        state.accounts[idx].color = color;
      }
      showToast('Rekening berhasil diperbarui');
    } else {
      state.accounts.push({
        id: generateId('acc'),
        name,
        type,
        balance,
        number,
        color,
        createdAt: getTodayStr()
      });
      showToast('Rekening baru berhasil ditambahkan');
    }

    saveState();
    closeModal('modalAccount');
    renderActiveView(window.location.hash.replace('#', '') || 'accounts');
  }

  function confirmDeleteAccount(accId) {
    openConfirmDialog(
      'Hapus Rekening',
      'Menghapus rekening ini tidak akan menghapus riwayat transaksi lama yang terhubung dengannya. Lanjutkan?',
      function () {
        state.accounts = state.accounts.filter(a => a.id !== accId);
        saveState();
        showToast('Rekening berhasil dihapus');
        renderActiveView(window.location.hash.replace('#', '') || 'accounts');
      }
    );
  }

  // =========================================================================
  // 20. TRANSFER MODAL HANDLER
  // =========================================================================
  function openTransferModal() {
    const fromSelect = document.getElementById('transferFromAcc');
    const toSelect = document.getElementById('transferToAcc');

    let opts = '';
    state.accounts.forEach(acc => {
      opts += `<option value="${acc.id}">${escapeHtml(acc.name)} (${formatCurrency(acc.balance)})</option>`;
    });

    if (fromSelect) fromSelect.innerHTML = opts;
    if (toSelect) toSelect.innerHTML = opts;

    document.getElementById('formTransfer').reset();
    document.getElementById('transferDate').value = getTodayStr();
    openModal('modalTransfer');
  }

  function saveTransfer(e) {
    e.preventDefault();
    const fromId = document.getElementById('transferFromAcc').value;
    const toId = document.getElementById('transferToAcc').value;
    const amount = Number(document.getElementById('transferAmount').value);
    const date = document.getElementById('transferDate').value;
    const notes = document.getElementById('transferNotes').value.trim();

    if (!amount || amount <= 0) {
      showToast('Masukkan nominal transfer yang valid', 'error');
      return;
    }

    if (fromId === toId) {
      showToast('Rekening asal dan tujuan tidak boleh sama', 'error');
      return;
    }

    const fromAcc = state.accounts.find(a => a.id === fromId);
    const toAcc = state.accounts.find(a => a.id === toId);

    const txData = {
      id: generateId('tx'),
      type: 'transfer',
      amount: amount,
      date: date,
      category: 'Transfer Antar Akun',
      accountId: fromId,
      toAccountId: toId,
      description: `Transfer: ${fromAcc ? fromAcc.name : ''} ke ${toAcc ? toAcc.name : ''}`,
      notes: notes
    };

    applyTransactionImpact(txData);
    state.transactions.unshift(txData);
    saveState();

    showToast('Transfer saldo antar rekening berhasil dilakukan!');
    closeModal('modalTransfer');
    renderActiveView(window.location.hash.replace('#', '') || 'accounts');
  }

  // =========================================================================
  // 21. CRUD HANDLERS FOR BUDGET
  // =========================================================================
  function openAddBudgetModal() {
    const catSelect = document.getElementById('budgetCategory');
    if (catSelect) {
      catSelect.innerHTML = DEFAULT_CATEGORIES.expense.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    }

    document.getElementById('budgetEditId').value = '';
    document.getElementById('modalBudgetTitle').textContent = 'Atur Anggaran Kategori';
    document.getElementById('formBudget').reset();
    document.getElementById('budgetMonth').value = getCurrentMonthStr();

    openModal('modalBudget');
  }

  function openEditBudget(bgtId) {
    const bgt = state.budgets.find(b => b.id === bgtId);
    if (!bgt) return;

    const catSelect = document.getElementById('budgetCategory');
    if (catSelect) {
      catSelect.innerHTML = DEFAULT_CATEGORIES.expense.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
      catSelect.value = bgt.category;
    }

    document.getElementById('budgetEditId').value = bgt.id;
    document.getElementById('modalBudgetTitle').textContent = 'Edit Anggaran Kategori';
    document.getElementById('budgetAmount').value = bgt.amount;
    document.getElementById('budgetMonth').value = bgt.month;

    openModal('modalBudget');
  }

  function saveBudget(e) {
    e.preventDefault();
    const editId = document.getElementById('budgetEditId').value;
    const category = document.getElementById('budgetCategory').value;
    const amount = Number(document.getElementById('budgetAmount').value);
    const month = document.getElementById('budgetMonth').value;

    if (!amount || amount <= 0) {
      showToast('Masukkan nominal anggaran yang valid', 'error');
      return;
    }

    if (editId) {
      const idx = state.budgets.findIndex(b => b.id === editId);
      if (idx !== -1) {
        state.budgets[idx].category = category;
        state.budgets[idx].amount = amount;
        state.budgets[idx].month = month;
      }
      showToast('Anggaran berhasil diperbarui');
    } else {
      // Check duplicate category in same month
      const existing = state.budgets.find(b => b.category === category && b.month === month);
      if (existing) {
        existing.amount = amount;
        showToast(`Anggaran untuk kategori ${category} bulan ${month} diperbarui`);
      } else {
        state.budgets.push({
          id: generateId('bgt'),
          category,
          amount,
          month
        });
        showToast('Anggaran baru berhasil disimpan');
      }
    }

    saveState();
    closeModal('modalBudget');
    renderActiveView(window.location.hash.replace('#', '') || 'budget');
  }

  function confirmDeleteBudget(bgtId) {
    openConfirmDialog(
      'Hapus Anggaran',
      'Apakah Anda yakin ingin menghapus batasan anggaran ini?',
      function () {
        state.budgets = state.budgets.filter(b => b.id !== bgtId);
        saveState();
        showToast('Anggaran berhasil dihapus');
        renderActiveView(window.location.hash.replace('#', '') || 'budget');
      }
    );
  }

  // =========================================================================
  // 22. CRUD HANDLERS FOR SAVINGS GOALS
  // =========================================================================
  function openAddSavingsGoalModal() {
    document.getElementById('savingsEditId').value = '';
    document.getElementById('modalSavingsTitle').textContent = 'Target Tabungan Baru';
    document.getElementById('formSavings').reset();
    document.getElementById('savingsDeadline').value = getTodayStr();
    openModal('modalSavings');
  }

  function openEditSavingsGoal(goalId) {
    const goal = state.savingsGoals.find(g => g.id === goalId);
    if (!goal) return;

    document.getElementById('savingsEditId').value = goal.id;
    document.getElementById('modalSavingsTitle').textContent = 'Edit Target Tabungan';
    document.getElementById('savingsTitle').value = goal.title;
    document.getElementById('savingsTargetAmount').value = goal.targetAmount;
    document.getElementById('savingsInitialAmount').value = goal.currentAmount;
    document.getElementById('savingsDeadline').value = goal.deadline;
    document.getElementById('savingsCategory').value = goal.category || 'Dana Darurat';

    openModal('modalSavings');
  }

  function saveSavingsGoal(e) {
    e.preventDefault();
    const editId = document.getElementById('savingsEditId').value;
    const title = document.getElementById('savingsTitle').value.trim();
    const targetAmount = Number(document.getElementById('savingsTargetAmount').value);
    const initialAmount = Number(document.getElementById('savingsInitialAmount').value) || 0;
    const deadline = document.getElementById('savingsDeadline').value;
    const category = document.getElementById('savingsCategory').value;

    if (!title || !targetAmount || targetAmount <= 0) {
      showToast('Masukkan target tabungan dan nominal yang valid', 'error');
      return;
    }

    if (editId) {
      const idx = state.savingsGoals.findIndex(g => g.id === editId);
      if (idx !== -1) {
        state.savingsGoals[idx].title = title;
        state.savingsGoals[idx].targetAmount = targetAmount;
        state.savingsGoals[idx].currentAmount = initialAmount;
        state.savingsGoals[idx].deadline = deadline;
        state.savingsGoals[idx].category = category;
      }
      showToast('Target tabungan berhasil diperbarui');
    } else {
      state.savingsGoals.push({
        id: generateId('goal'),
        title,
        targetAmount,
        currentAmount: initialAmount,
        deadline,
        category
      });
      showToast('Target tabungan baru berhasil dibuat');
    }

    saveState();
    closeModal('modalSavings');
    renderActiveView(window.location.hash.replace('#', '') || 'savings');
  }

  function confirmDeleteSavingsGoal(goalId) {
    openConfirmDialog(
      'Hapus Target Tabungan',
      'Apakah Anda yakin ingin menghapus target tabungan ini?',
      function () {
        state.savingsGoals = state.savingsGoals.filter(g => g.id !== goalId);
        saveState();
        showToast('Target tabungan berhasil dihapus');
        renderActiveView(window.location.hash.replace('#', '') || 'savings');
      }
    );
  }

  function openSavingsDepositModal(goalId) {
    const goal = state.savingsGoals.find(g => g.id === goalId);
    if (!goal) return;

    document.getElementById('depositGoalId').value = goal.id;
    document.getElementById('depositGoalPrompt').textContent = `Alokasi setoran untuk "${goal.title}". Sisa target: ${formatCurrency(Math.max(0, goal.targetAmount - goal.currentAmount))}`;

    const accSelect = document.getElementById('depositAccount');
    let opts = '';
    state.accounts.forEach(a => {
      opts += `<option value="${a.id}">${escapeHtml(a.name)} (${formatCurrency(a.balance)})</option>`;
    });
    if (accSelect) accSelect.innerHTML = opts;

    document.getElementById('formSavingsDeposit').reset();
    document.getElementById('depositDate').value = getTodayStr();

    openModal('modalSavingsDeposit');
  }

  function saveSavingsDeposit(e) {
    e.preventDefault();
    const goalId = document.getElementById('depositGoalId').value;
    const amount = Number(document.getElementById('depositAmount').value);
    const accountId = document.getElementById('depositAccount').value;
    const date = document.getElementById('depositDate').value;

    const goal = state.savingsGoals.find(g => g.id === goalId);
    const account = state.accounts.find(a => a.id === accountId);

    if (!goal || !amount || amount <= 0) {
      showToast('Masukkan nominal setoran yang valid', 'error');
      return;
    }

    // Deduct from account balance
    if (account) {
      account.balance = (Number(account.balance) || 0) - amount;
    }

    // Add to goal current amount
    goal.currentAmount = (Number(goal.currentAmount) || 0) + amount;

    // Record as transaction
    state.transactions.unshift({
      id: generateId('tx'),
      type: 'expense',
      category: 'Investasi / Tabungan',
      amount: amount,
      date: date,
      accountId: accountId,
      toAccountId: null,
      description: `Setoran Tabungan: ${goal.title}`,
      notes: 'Alokasi ke pos tabungan masa depan'
    });

    saveState();
    closeModal('modalSavingsDeposit');
    showToast(`Berhasil menyetor ${formatCurrency(amount)} ke "${goal.title}"!`);
    renderActiveView(window.location.hash.replace('#', '') || 'savings');
  }

  // =========================================================================
  // 23. CRUD HANDLERS FOR INCOME
  // =========================================================================
  function openAddIncomeModal() {
    document.getElementById('incomeEditId').value = '';
    document.getElementById('modalIncomeTitle').textContent = 'Catat Sumber / Tagihan Pendapatan';
    document.getElementById('formIncome').reset();
    document.getElementById('incDueDate').value = getTodayStr();

    const accSelect = document.getElementById('incAccount');
    if (accSelect) {
      accSelect.innerHTML = state.accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    }

    openModal('modalIncome');
  }

  function openEditIncome(incId) {
    const inc = state.incomes.find(i => i.id === incId);
    if (!inc) return;

    document.getElementById('incomeEditId').value = inc.id;
    document.getElementById('modalIncomeTitle').textContent = 'Edit Catatan Pendapatan';
    document.getElementById('incSource').value = inc.source;
    document.getElementById('incType').value = inc.type;
    document.getElementById('incAmount').value = inc.amount;
    document.getElementById('incDueDate').value = inc.dueDate;
    document.getElementById('incStatus').value = inc.status;

    const accSelect = document.getElementById('incAccount');
    if (accSelect) {
      accSelect.innerHTML = state.accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
      if (inc.accountId) accSelect.value = inc.accountId;
    }

    openModal('modalIncome');
  }

  function saveIncome(e) {
    e.preventDefault();
    const editId = document.getElementById('incomeEditId').value;
    const source = document.getElementById('incSource').value.trim();
    const type = document.getElementById('incType').value;
    const amount = Number(document.getElementById('incAmount').value);
    const dueDate = document.getElementById('incDueDate').value;
    const status = document.getElementById('incStatus').value;
    const accountId = document.getElementById('incAccount').value;

    if (!source || !amount || amount <= 0) {
      showToast('Masukkan sumber dan nominal pendapatan yang valid', 'error');
      return;
    }

    if (editId) {
      const idx = state.incomes.findIndex(i => i.id === editId);
      if (idx !== -1) {
        state.incomes[idx].source = source;
        state.incomes[idx].type = type;
        state.incomes[idx].amount = amount;
        state.incomes[idx].dueDate = dueDate;
        state.incomes[idx].status = status;
        state.incomes[idx].accountId = accountId;
      }
      showToast('Catatan pendapatan diperbarui');
    } else {
      state.incomes.push({
        id: generateId('inc'),
        source,
        type,
        amount,
        dueDate,
        status,
        accountId
      });

      // If status is received upon creation, also record income transaction
      if (status === 'received' && accountId) {
        const acc = state.accounts.find(a => a.id === accountId);
        if (acc) {
          acc.balance = (Number(acc.balance) || 0) + amount;
        }
        state.transactions.unshift({
          id: generateId('tx'),
          type: 'income',
          category: type === 'Gaji Pokok' ? 'Gaji Pokok' : (type === 'Freelance' ? 'Freelance & Proyek' : 'Lainnya'),
          amount: amount,
          date: dueDate,
          accountId: accountId,
          toAccountId: null,
          description: `Pendapatan: ${source}`,
          notes: 'Dicatat dari modul Pelacakan Pendapatan'
        });
      }

      showToast('Catatan pendapatan berhasil ditambahkan');
    }

    saveState();
    closeModal('modalIncome');
    renderActiveView(window.location.hash.replace('#', '') || 'income');
  }

  function markIncomeReceived(incId) {
    const inc = state.incomes.find(i => i.id === incId);
    if (!inc) return;

    // Pick first bank/wallet account
    const acc = state.accounts.find(a => a.id === inc.accountId) || state.accounts[0];
    if (acc) {
      acc.balance = (Number(acc.balance) || 0) + Number(inc.amount);
    }

    inc.status = 'received';

    // Record as transaction
    state.transactions.unshift({
      id: generateId('tx'),
      type: 'income',
      category: inc.type === 'Gaji Pokok' ? 'Gaji Pokok' : (inc.type === 'Freelance' ? 'Freelance & Proyek' : 'Lainnya'),
      amount: Number(inc.amount),
      date: getTodayStr(),
      accountId: acc ? acc.id : state.accounts[0]?.id,
      toAccountId: null,
      description: `Pelunasan Pendapatan: ${inc.source}`,
      notes: 'Pencairan invoice tertunda'
    });

    saveState();
    showToast(`Invoice "${inc.source}" telah dicairkan dan masuk ke rekening!`);
    renderActiveView('income');
  }

  function confirmDeleteIncome(incId) {
    openConfirmDialog(
      'Hapus Pendapatan',
      'Apakah Anda yakin ingin menghapus catatan pendapatan ini?',
      function () {
        state.incomes = state.incomes.filter(i => i.id !== incId);
        saveState();
        showToast('Catatan pendapatan berhasil dihapus');
        renderActiveView(window.location.hash.replace('#', '') || 'income');
      }
    );
  }

  // =========================================================================
  // 24. CRUD HANDLERS FOR INVESTMENTS
  // =========================================================================
  function openAddAssetModal() {
    document.getElementById('assetEditId').value = '';
    document.getElementById('modalAssetTitle').textContent = 'Tambah Aset Investasi Baru';
    document.getElementById('formAsset').reset();
    openModal('modalAsset');
  }

  function openEditAsset(assetId) {
    const asset = state.investments.find(a => a.id === assetId);
    if (!asset) return;

    document.getElementById('assetEditId').value = asset.id;
    document.getElementById('modalAssetTitle').textContent = 'Edit Data Aset Investasi';
    document.getElementById('assetName').value = asset.name;
    document.getElementById('assetType').value = asset.type;
    document.getElementById('assetQuantity').value = asset.quantity;
    document.getElementById('assetBuyPrice').value = asset.buyPrice;
    document.getElementById('assetCurrentPrice').value = asset.currentPrice;

    openModal('modalAsset');
  }

  function saveAsset(e) {
    e.preventDefault();
    const editId = document.getElementById('assetEditId').value;
    const name = document.getElementById('assetName').value.trim();
    const type = document.getElementById('assetType').value;
    const quantity = Number(document.getElementById('assetQuantity').value);
    const buyPrice = Number(document.getElementById('assetBuyPrice').value);
    const currentPrice = Number(document.getElementById('assetCurrentPrice').value);

    if (!name || quantity <= 0 || buyPrice < 0 || currentPrice < 0) {
      showToast('Masukkan data aset yang valid', 'error');
      return;
    }

    if (editId) {
      const idx = state.investments.findIndex(a => a.id === editId);
      if (idx !== -1) {
        state.investments[idx].name = name;
        state.investments[idx].type = type;
        state.investments[idx].quantity = quantity;
        state.investments[idx].buyPrice = buyPrice;
        state.investments[idx].currentPrice = currentPrice;
      }
      showToast('Aset investasi berhasil diperbarui');
    } else {
      state.investments.push({
        id: generateId('inv'),
        name,
        type,
        quantity,
        buyPrice,
        currentPrice
      });
      showToast('Aset investasi baru berhasil ditambahkan');
    }

    saveState();
    closeModal('modalAsset');
    renderActiveView(window.location.hash.replace('#', '') || 'investments');
  }

  function openUpdatePriceModal(assetId) {
    const asset = state.investments.find(a => a.id === assetId);
    if (!asset) return;

    document.getElementById('priceAssetId').value = asset.id;
    document.getElementById('priceAssetNamePrompt').textContent = `Perbarui harga pasar terkini untuk "${asset.name}". Harga saat ini: ${formatCurrency(asset.currentPrice)}`;
    document.getElementById('priceNewValue').value = asset.currentPrice;

    openModal('modalPriceUpdate');
  }

  function savePriceUpdate(e) {
    e.preventDefault();
    const assetId = document.getElementById('priceAssetId').value;
    const newPrice = Number(document.getElementById('priceNewValue').value);

    const asset = state.investments.find(a => a.id === assetId);
    if (!asset || newPrice < 0) {
      showToast('Masukkan harga pasar yang valid', 'error');
      return;
    }

    asset.currentPrice = newPrice;
    saveState();
    closeModal('modalPriceUpdate');
    showToast(`Harga pasar untuk "${asset.name}" berhasil diperbarui!`);
    renderActiveView(window.location.hash.replace('#', '') || 'investments');
  }

  function confirmDeleteAsset(assetId) {
    openConfirmDialog(
      'Hapus Aset Investasi',
      'Apakah Anda yakin ingin menghapus aset investasi ini dari portofolio Anda?',
      function () {
        state.investments = state.investments.filter(a => a.id !== assetId);
        saveState();
        showToast('Aset investasi berhasil dihapus');
        renderActiveView(window.location.hash.replace('#', '') || 'investments');
      }
    );
  }

  // =========================================================================
  // 25. CRUD HANDLERS FOR DEBT MANAGEMENT
  // =========================================================================
  function openAddDebtModal() {
    document.getElementById('debtEditId').value = '';
    document.getElementById('modalDebtTitle').textContent = 'Catat Utang / Piutang';
    document.getElementById('formDebt').reset();
    document.getElementById('debtDueDate').value = getTodayStr();
    openModal('modalDebt');
  }

  function openEditDebt(debtId) {
    const debt = state.debts.find(d => d.id === debtId);
    if (!debt) return;

    document.getElementById('debtEditId').value = debt.id;
    document.getElementById('modalDebtTitle').textContent = 'Edit Data Utang / Piutang';
    document.getElementById('debtType').value = debt.type;
    document.getElementById('debtCounterparty').value = debt.counterparty;
    document.getElementById('debtTotalAmount').value = debt.totalAmount;
    document.getElementById('debtPaidAmount').value = debt.paidAmount || 0;
    document.getElementById('debtDueDate').value = debt.dueDate;
    document.getElementById('debtInterest').value = debt.interest || '';
    document.getElementById('debtNotes').value = debt.notes || '';

    openModal('modalDebt');
  }

  function saveDebt(e) {
    e.preventDefault();
    const editId = document.getElementById('debtEditId').value;
    const type = document.getElementById('debtType').value;
    const counterparty = document.getElementById('debtCounterparty').value.trim();
    const totalAmount = Number(document.getElementById('debtTotalAmount').value);
    const paidAmount = Number(document.getElementById('debtPaidAmount').value) || 0;
    const dueDate = document.getElementById('debtDueDate').value;
    const interest = document.getElementById('debtInterest').value.trim();
    const notes = document.getElementById('debtNotes').value.trim();

    if (!counterparty || totalAmount <= 0) {
      showToast('Masukkan data pinjaman yang valid', 'error');
      return;
    }

    if (editId) {
      const idx = state.debts.findIndex(d => d.id === editId);
      if (idx !== -1) {
        state.debts[idx].type = type;
        state.debts[idx].counterparty = counterparty;
        state.debts[idx].totalAmount = totalAmount;
        state.debts[idx].paidAmount = paidAmount;
        state.debts[idx].dueDate = dueDate;
        state.debts[idx].interest = interest;
        state.debts[idx].notes = notes;
      }
      showToast('Data utang/piutang berhasil diperbarui');
    } else {
      state.debts.push({
        id: generateId('debt'),
        type,
        counterparty,
        totalAmount,
        paidAmount,
        dueDate,
        interest,
        notes
      });
      showToast('Data utang/piutang baru berhasil dicatat');
    }

    saveState();
    closeModal('modalDebt');
    renderActiveView(window.location.hash.replace('#', '') || 'debt');
  }

  function openDebtPaymentModal(debtId) {
    const debt = state.debts.find(d => d.id === debtId);
    if (!debt) return;

    const remaining = Math.max(0, debt.totalAmount - (debt.paidAmount || 0));
    document.getElementById('payDebtId').value = debt.id;
    document.getElementById('payDebtPrompt').textContent = `Catat pembayaran untuk "${debt.counterparty}". Sisa belum lunas: ${formatCurrency(remaining)}`;
    document.getElementById('payAmount').value = remaining;

    const label = document.getElementById('payAccountLabel');
    if (label) {
      label.textContent = debt.type === 'payable' ? 'Potong dari Rekening (Kewajiban)' : 'Masuk ke Rekening (Penerimaan)';
    }

    const accSelect = document.getElementById('payAccount');
    if (accSelect) {
      accSelect.innerHTML = state.accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${formatCurrency(a.balance)})</option>`).join('');
    }

    document.getElementById('payDate').value = getTodayStr();
    openModal('modalDebtPayment');
  }

  function saveDebtPayment(e) {
    e.preventDefault();
    const debtId = document.getElementById('payDebtId').value;
    const amount = Number(document.getElementById('payAmount').value);
    const accountId = document.getElementById('payAccount').value;
    const date = document.getElementById('payDate').value;

    const debt = state.debts.find(d => d.id === debtId);
    const account = state.accounts.find(a => a.id === accountId);

    if (!debt || amount <= 0) {
      showToast('Masukkan nominal pembayaran yang valid', 'error');
      return;
    }

    debt.paidAmount = (Number(debt.paidAmount) || 0) + amount;

    if (debt.type === 'payable') {
      // Paying debt reduces account balance
      if (account) account.balance = (Number(account.balance) || 0) - amount;

      state.transactions.unshift({
        id: generateId('tx'),
        type: 'expense',
        category: 'Cicilan & Utang',
        amount: amount,
        date: date,
        accountId: accountId,
        toAccountId: null,
        description: `Pembayaran Utang: ${debt.counterparty}`,
        notes: 'Pelunasan cicilan pinjaman'
      });
    } else {
      // Receiving receivable increases account balance
      if (account) account.balance = (Number(account.balance) || 0) + amount;

      state.transactions.unshift({
        id: generateId('tx'),
        type: 'income',
        category: 'Lainnya',
        amount: amount,
        date: date,
        accountId: accountId,
        toAccountId: null,
        description: `Penerimaan Piutang dari: ${debt.counterparty}`,
        notes: 'Pelunasan piutang'
      });
    }

    saveState();
    closeModal('modalDebtPayment');
    showToast(`Pembayaran ${formatCurrency(amount)} berhasil dicatat!`);
    renderActiveView(window.location.hash.replace('#', '') || 'debt');
  }

  function confirmDeleteDebt(debtId) {
    openConfirmDialog(
      'Hapus Utang / Piutang',
      'Apakah Anda yakin ingin menghapus catatan utang/piutang ini?',
      function () {
        state.debts = state.debts.filter(d => d.id !== debtId);
        saveState();
        showToast('Catatan utang/piutang berhasil dihapus');
        renderActiveView(window.location.hash.replace('#', '') || 'debt');
      }
    );
  }

  // =========================================================================
  // 26. CONFIRMATION DIALOG HELPER
  // =========================================================================
  function openConfirmDialog(title, message, onConfirmCallback) {
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const btnConfirm = document.getElementById('btnConfirmAction');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    pendingConfirmAction = onConfirmCallback;
    openModal('modalConfirm');
  }

  // =========================================================================
  // 27. MOBILE NAVIGATION & BACKDROP
  // =========================================================================
  function initMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const menuBtn = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('mobileCloseBtn');

    if (menuBtn) {
      menuBtn.addEventListener('click', function () {
        if (sidebar) sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('active');
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeMobileSidebar);
    }

    if (backdrop) {
      backdrop.addEventListener('click', closeMobileSidebar);
    }
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  }

  // =========================================================================
  // 28. EVENT LISTENERS & INITIALIZATION
  // =========================================================================
  function attachEventListeners() {
    // Quick Add Button
    const btnQuick = document.getElementById('btnQuickTransaction');
    if (btnQuick) {
      btnQuick.addEventListener('click', () => openAddTransactionModal('expense'));
    }

    // Modal Trigger Buttons
    const btnOpenAddTx = document.getElementById('btnOpenAddTxModal');
    if (btnOpenAddTx) btnOpenAddTx.addEventListener('click', () => openAddTransactionModal('expense'));

    const btnOpenAddAcc = document.getElementById('btnOpenAddAccountModal');
    if (btnOpenAddAcc) btnOpenAddAcc.addEventListener('click', openAddAccountModal);

    const btnOpenTransfer = document.getElementById('btnOpenTransferModal');
    if (btnOpenTransfer) btnOpenTransfer.addEventListener('click', openTransferModal);

    const btnOpenAddBudget = document.getElementById('btnOpenAddBudgetModal');
    if (btnOpenAddBudget) btnOpenAddBudget.addEventListener('click', openAddBudgetModal);

    const btnOpenAddSavings = document.getElementById('btnOpenAddSavingsModal');
    if (btnOpenAddSavings) btnOpenAddSavings.addEventListener('click', openAddSavingsGoalModal);

    const btnOpenAddInc = document.getElementById('btnOpenAddIncomeModal');
    if (btnOpenAddInc) btnOpenAddInc.addEventListener('click', openAddIncomeModal);

    const btnOpenAddAsset = document.getElementById('btnOpenAddAssetModal');
    if (btnOpenAddAsset) btnOpenAddAsset.addEventListener('click', openAddAssetModal);

    const btnOpenTrade = document.getElementById('btnOpenInvestmentTradeModal');
    if (btnOpenTrade) btnOpenTrade.addEventListener('click', openAddAssetModal);

    const btnOpenAddDebt = document.getElementById('btnOpenAddDebtModal');
    if (btnOpenAddDebt) btnOpenAddDebt.addEventListener('click', openAddDebtModal);

    // Form Submissions
    document.getElementById('formTransaction')?.addEventListener('submit', saveTransaction);
    document.getElementById('formAccount')?.addEventListener('submit', saveAccount);
    document.getElementById('formTransfer')?.addEventListener('submit', saveTransfer);
    document.getElementById('formBudget')?.addEventListener('submit', saveBudget);
    document.getElementById('formSavings')?.addEventListener('submit', saveSavingsGoal);
    document.getElementById('formSavingsDeposit')?.addEventListener('submit', saveSavingsDeposit);
    document.getElementById('formIncome')?.addEventListener('submit', saveIncome);
    document.getElementById('formAsset')?.addEventListener('submit', saveAsset);
    document.getElementById('formPriceUpdate')?.addEventListener('submit', savePriceUpdate);
    document.getElementById('formDebt')?.addEventListener('submit', saveDebt);
    document.getElementById('formDebtPayment')?.addEventListener('submit', saveDebtPayment);

    // Confirmation Action Button
    document.getElementById('btnConfirmAction')?.addEventListener('click', function () {
      if (typeof pendingConfirmAction === 'function') {
        pendingConfirmAction();
        pendingConfirmAction = null;
      }
      closeModal('modalConfirm');
    });

    // Transaction Type Selector inside Modal
    document.querySelectorAll('.tx-type-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        setTransactionModalType(this.dataset.txType);
      });
    });

    // Transaction Filters
    const searchInput = document.getElementById('txSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        txFilterState.search = this.value;
        filterAndRenderTransactionsTable();
      });
    }

    const typeFilter = document.getElementById('txFilterType');
    if (typeFilter) {
      typeFilter.addEventListener('change', function () {
        txFilterState.type = this.value;
        filterAndRenderTransactionsTable();
      });
    }

    const catFilter = document.getElementById('txFilterCategory');
    if (catFilter) {
      catFilter.addEventListener('change', function () {
        txFilterState.category = this.value;
        filterAndRenderTransactionsTable();
      });
    }

    const accFilter = document.getElementById('txFilterAccount');
    if (accFilter) {
      accFilter.addEventListener('change', function () {
        txFilterState.account = this.value;
        filterAndRenderTransactionsTable();
      });
    }

    const monthFilter = document.getElementById('txFilterMonth');
    if (monthFilter) {
      monthFilter.addEventListener('change', function () {
        txFilterState.month = this.value;
        filterAndRenderTransactionsTable();
      });
    }

    const btnResetFilters = document.getElementById('btnResetTxFilters');
    if (btnResetFilters) {
      btnResetFilters.addEventListener('click', function () {
        txFilterState.search = '';
        txFilterState.type = 'all';
        txFilterState.category = 'all';
        txFilterState.account = 'all';
        txFilterState.month = 'all';

        if (searchInput) searchInput.value = '';
        if (typeFilter) typeFilter.value = 'all';
        if (catFilter) catFilter.value = 'all';
        if (accFilter) accFilter.value = 'all';
        if (monthFilter) monthFilter.value = 'all';

        filterAndRenderTransactionsTable();
      });
    }

    // Budget Month Selector
    const budgetMonthSelector = document.getElementById('budgetMonthSelector');
    if (budgetMonthSelector) {
      budgetMonthSelector.addEventListener('change', renderBudgetView);
    }

    // Income Tabs
    document.querySelectorAll('[data-income-tab]').forEach(tab => {
      tab.addEventListener('click', function () {
        document.querySelectorAll('[data-income-tab]').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        activeIncomeTab = this.dataset.incomeTab;
        renderIncomeView();
      });
    });

    // Debt Tabs
    document.querySelectorAll('[data-debt-tab]').forEach(tab => {
      tab.addEventListener('click', function () {
        document.querySelectorAll('[data-debt-tab]').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        activeDebtTab = this.dataset.debtTab;
        renderDebtView();
      });
    });

    // Reports Range Buttons
    document.querySelectorAll('[data-report-range]').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-report-range]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        activeReportRange = this.dataset.reportRange;
        renderReportsView();
      });
    });

    // Reports Actions
    document.getElementById('btnExportCSV')?.addEventListener('click', exportTransactionsCSV);
    document.getElementById('btnPrintReport')?.addEventListener('click', () => window.print());

    // Settings Actions
    document.getElementById('settingsForm')?.addEventListener('submit', function (e) {
      e.preventDefault();
      state.settings.userName = document.getElementById('setUserName').value.trim() || 'John Doe';
      state.settings.currency = document.getElementById('setCurrency').value;
      state.settings.dateFormat = document.getElementById('setDateFormat').value;
      saveState();
      updateTopIndicators();
      showToast('Preferensi pengguna berhasil disimpan!');
    });

    document.getElementById('btnExportJSON')?.addEventListener('click', exportBackupJSON);

    const btnTriggerImport = document.getElementById('btnTriggerImportJSON');
    const fileInput = document.getElementById('importJsonFileInput');
    if (btnTriggerImport && fileInput) {
      btnTriggerImport.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
          importBackupJSON(e.target.files[0]);
        }
      });
    }

    document.getElementById('btnLoadDemoData')?.addEventListener('click', function () {
      openConfirmDialog(
        'Muat Ulang Data Demo',
        'Data Anda saat ini akan ditimpa dengan contoh data demo baru. Lanjutkan?',
        function () {
          state = generateDemoData();
          saveState();
          showToast('Data demo berhasil dimuat ulang!');
          renderActiveView(window.location.hash.replace('#', '') || 'dashboard');
        }
      );
    });

    document.getElementById('btnResetAllData')?.addEventListener('click', function () {
      openConfirmDialog(
        'Kosongkan Seluruh Data',
        'Tindakan ini akan menghapus seluruh catatan transaksi, rekening, anggaran, dan investasi secara permanen!',
        function () {
          state = {
            settings: { userName: 'User', currency: 'IDR', dateFormat: 'id-ID', theme: 'dark' },
            accounts: [],
            transactions: [],
            budgets: [],
            savingsGoals: [],
            incomes: [],
            investments: [],
            debts: []
          };
          saveState();
          showToast('Seluruh data aplikasi telah dikosongkan.');
          renderActiveView(window.location.hash.replace('#', '') || 'dashboard');
        }
      );
    });
  }

  // =========================================================================
  // 29. BOOTSTRAP APPLICATION
  // =========================================================================
  function init() {
    loadState();
    initMobileMenu();
    initModals();
    attachEventListeners();
    initNavigation();

    // Lucide icons init
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // Expose global namespace for inline actions
  window.FINANCE_OS = {
    openEditTransaction,
    confirmDeleteTransaction,
    openEditAccount,
    confirmDeleteAccount,
    openEditBudget,
    confirmDeleteBudget,
    openEditSavingsGoal,
    confirmDeleteSavingsGoal,
    openSavingsDepositModal,
    openEditIncome,
    markIncomeReceived,
    confirmDeleteIncome,
    openEditAsset,
    openUpdatePriceModal,
    confirmDeleteAsset,
    openEditDebt,
    openDebtPaymentModal,
    confirmDeleteDebt
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
