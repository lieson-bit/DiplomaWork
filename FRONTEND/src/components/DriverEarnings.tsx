import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Progress } from "./ui/progress";
import { DollarSign, CreditCard, Building2, Wallet, TrendingUp, Calendar, Clock, CheckCircle, AlertCircle, ArrowUpRight, ArrowDownLeft, Plus, Banknote, Smartphone, Trash2, Edit2, Eye, Fuel, Coffee, ShoppingBag, Home, Car, Utensils, Gift, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { orderApi } from '../src/lib/api';
import { getCurrentUser } from '../src/lib/auth-utils';
import { useLanguage } from './LanguageContext';

interface PaymentMethod {
  id: string;
  type: 'bank' | 'cash' | 'digital_wallet';
  name: string;
  details: string;
  isDefault: boolean;
  isActive: boolean;
  accountHolder?: string;
  accountNumber?: string;
  routingNumber?: string;
  email?: string;
}

interface Transaction {
  id: string;
  orderId: string;
  amount: number;
  type: 'earning' | 'payout' | 'fee' | 'bonus' | 'spending';
  status: 'completed' | 'pending' | 'processing' | 'failed';
  paymentMethod: string;
  date: string;
  description: string;
  customerName?: string;
  category?: 'fuel' | 'food' | 'maintenance' | 'supplies' | 'other';
}

interface EarningsData {
  totalEarnings: number;
  availableBalance: number;
  pendingPayments: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  yearlyEarnings: number;
  totalWithdrawn: number;
  totalSpent: number;
  payoutSchedule: 'instant' | 'daily' | 'weekly';
  nextPayoutDate: string;
  minimumPayout: number;
  savingsGoal: number;
  currentSavings: number;
}

interface DriverOrder {
  id: string;
  order_number: string;
  status: string;
  pricing?: {
    estimated_usd: number;
  };
  customer_info?: {
    name: string;
  };
  delivery_completed_at?: string;
  created_at: string;
}

export function DriverEarnings() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [isAddingSpending, setIsAddingSpending] = useState(false);
  const [selectedWithdrawMethod, setSelectedWithdrawMethod] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [spendingAmount, setSpendingAmount] = useState<string>('');
  const [spendingCategory, setSpendingCategory] = useState<string>('');
  const [spendingDescription, setSpendingDescription] = useState<string>('');
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [driverOrders, setDriverOrders] = useState<DriverOrder[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [transactionType, setTransactionType] = useState('all');

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    {
      id: 'BANK001',
      type: 'bank',
      name: 'Chase Bank',
      details: 'Account ending in 4567',
      isDefault: true,
      isActive: true,
      accountHolder: 'Lieson Mwale',
      accountNumber: '****4567',
      routingNumber: '****2100'
    },
    {
      id: 'CASH001',
      type: 'cash',
      name: 'Cash Payments',
      details: 'Collect cash directly from customers',
      isDefault: false,
      isActive: true
    }
  ]);

  const [earningsData, setEarningsData] = useState<EarningsData>({
    totalEarnings: 0,
    availableBalance: 0,
    pendingPayments: 0,
    weeklyEarnings: 0,
    monthlyEarnings: 0,
    yearlyEarnings: 0,
    totalWithdrawn: 0,
    totalSpent: 0,
    payoutSchedule: 'weekly',
    nextPayoutDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    minimumPayout: 50,
    savingsGoal: 5000,
    currentSavings: 0
  });

  // Load driver orders and calculate earnings
  useEffect(() => {
    loadDriverOrders();
  }, []);

  // Recalculate earnings when orders or transactions change
  useEffect(() => {
    calculateEarningsFromOrders();
  }, [driverOrders, transactions]);

  const loadDriverOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await orderApi.getDriverOrders();
      console.log('📦 Driver orders for earnings:', response);
      
      if (response.success && response.data) {
        const orders = response.data.orders || [];
        setDriverOrders(orders);
        
        // Create transactions from completed orders
        const orderTransactions: Transaction[] = orders
          .filter((order: DriverOrder) => order.status === 'completed' || order.status === 'delivered')
          .map((order: DriverOrder) => ({
            id: `ORD-${order.id}`,
            orderId: order.order_number,
            amount: order.pricing?.estimated_usd || 0,
            type: 'earning' as const,
            status: 'completed' as const,
            paymentMethod: t('driverEarnings.payment_methods.bank_transfer'),
            date: order.delivery_completed_at || order.created_at,
            description: t('driverEarnings.transactions.delivery_payment', { orderNumber: order.order_number?.slice(-8) }),
            customerName: order.customer_info?.name
          }));
        
        // Add existing spending transactions (from localStorage)
        const savedSpending = localStorage.getItem('driver_spending_transactions');
        const spendingTransactions: Transaction[] = savedSpending ? JSON.parse(savedSpending) : [];
        
        // Add demo spending for testing (remove in production)
        const demoSpending: Transaction[] = [
          {
            id: 'SPEND-DEMO-1',
            orderId: 'EXP-001',
            amount: -45.00,
            type: 'spending',
            status: 'completed',
            paymentMethod: t('driverEarnings.payment_methods.credit_card'),
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            description: t('driverEarnings.spending.gas_refill'),
            category: 'fuel'
          },
          {
            id: 'SPEND-DEMO-2',
            orderId: 'EXP-002',
            amount: -25.50,
            type: 'spending',
            status: 'completed',
            paymentMethod: t('driverEarnings.payment_methods.cash'),
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            description: t('driverEarnings.spending.lunch_break'),
            category: 'food'
          }
        ];
        
        setTransactions([...orderTransactions, ...spendingTransactions, ...demoSpending]);
      }
    } catch (error) {
      console.error('Error loading driver orders:', error);
      toast.error(t('driverEarnings.errors.load_failed'));
    } finally {
      setLoadingOrders(false);
    }
  };

  const calculateEarningsFromOrders = () => {
    // Calculate from completed orders
    const completedOrders = driverOrders.filter(
      order => order.status === 'completed' || order.status === 'delivered'
    );
    
    const totalEarnings = completedOrders.reduce(
      (sum, order) => sum + (order.pricing?.estimated_usd || 0), 
      0
    );
    
    // Calculate pending payments (completed but not yet paid out)
    const pendingPayments = completedOrders
      .filter(order => {
        // Check if this order has been paid out
        const hasPayout = transactions.some(t => 
          t.type === 'payout' && t.orderId === order.order_number
        );
        return !hasPayout;
      })
      .reduce((sum, order) => sum + (order.pricing?.estimated_usd || 0), 0);
    
    // Calculate weekly earnings (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyEarnings = completedOrders
      .filter(order => new Date(order.delivery_completed_at || order.created_at) >= oneWeekAgo)
      .reduce((sum, order) => sum + (order.pricing?.estimated_usd || 0), 0);
    
    // Calculate monthly earnings (last 30 days)
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const monthlyEarnings = completedOrders
      .filter(order => new Date(order.delivery_completed_at || order.created_at) >= oneMonthAgo)
      .reduce((sum, order) => sum + (order.pricing?.estimated_usd || 0), 0);
    
    // Calculate yearly earnings (last 365 days)
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    const yearlyEarnings = completedOrders
      .filter(order => new Date(order.delivery_completed_at || order.created_at) >= oneYearAgo)
      .reduce((sum, order) => sum + (order.pricing?.estimated_usd || 0), 0);
    
    // Calculate total spending
    const totalSpent = Math.abs(
      transactions
        .filter(t => t.type === 'spending')
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    );
    
    // Calculate total withdrawn
    const totalWithdrawn = Math.abs(
      transactions
        .filter(t => t.type === 'payout')
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    );
    
    // Calculate available balance
    const availableBalance = totalEarnings - totalSpent - totalWithdrawn;
    
    setEarningsData(prev => ({
      ...prev,
      totalEarnings,
      availableBalance: Math.max(0, availableBalance),
      pendingPayments,
      weeklyEarnings,
      monthlyEarnings,
      yearlyEarnings,
      totalSpent,
      totalWithdrawn,
      currentSavings: Math.max(0, availableBalance * 0.3) // 30% of available balance as savings
    }));
  };

  const handleWithdraw = () => {
    if (!selectedWithdrawMethod || !withdrawAmount) {
      toast.error(t('driverEarnings.errors.select_method_and_amount'));
      return;
    }
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount)) {
      toast.error(t('driverEarnings.errors.valid_amount'));
      return;
    }
    
    if (amount < earningsData.minimumPayout) {
      toast.error(t('driverEarnings.errors.minimum_withdrawal', { min: earningsData.minimumPayout }));
      return;
    }
    
    if (amount > earningsData.availableBalance) {
      toast.error(t('driverEarnings.errors.insufficient_balance'));
      return;
    }

    const method = paymentMethods.find(p => p.id === selectedWithdrawMethod);
    
    const newTransaction: Transaction = {
      id: `WITHDRAW-${Date.now()}`,
      orderId: `WITHDRAW-${Date.now()}`,
      amount: -amount,
      type: 'payout',
      status: 'processing',
      paymentMethod: method?.name || t('driverEarnings.payment_methods.bank_transfer'),
      date: new Date().toISOString(),
      description: t('driverEarnings.transactions.withdrawal_description', { method: method?.name || t('driverEarnings.payment_methods.bank_account') })
    };
    
    setTransactions([newTransaction, ...transactions]);
    
    // Save to localStorage
    const spendingTransactions = transactions.filter(t => t.type === 'spending');
    localStorage.setItem('driver_spending_transactions', JSON.stringify(spendingTransactions));
    
    toast.success(t('driverEarnings.messages.withdrawal_initiated', { amount: amount.toFixed(2), method: method?.name }));
    setWithdrawAmount('');
    setSelectedWithdrawMethod('');
  };

  const handleAddSpending = () => {
    if (!spendingAmount || !spendingCategory || !spendingDescription) {
      toast.error(t('driverEarnings.errors.fill_all_fields'));
      return;
    }
    
    const amount = parseFloat(spendingAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('driverEarnings.errors.valid_amount_positive'));
      return;
    }
    
    const newTransaction: Transaction = {
      id: `SPEND-${Date.now()}`,
      orderId: `EXP-${Date.now()}`,
      amount: -amount,
      type: 'spending',
      status: 'completed',
      paymentMethod: t('driverEarnings.payment_methods.credit_card'),
      date: new Date().toISOString(),
      description: spendingDescription,
      category: spendingCategory as any
    };
    
    const updatedTransactions = [newTransaction, ...transactions];
    setTransactions(updatedTransactions);
    
    // Save to localStorage
    const spendingTransactions = updatedTransactions.filter(t => t.type === 'spending');
    localStorage.setItem('driver_spending_transactions', JSON.stringify(spendingTransactions));
    
    toast.success(t('driverEarnings.messages.spending_recorded', { amount: amount.toFixed(2) }));
    setSpendingAmount('');
    setSpendingCategory('');
    setSpendingDescription('');
    setIsAddingSpending(false);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
    
    // Update localStorage
    const spendingTransactions = transactions.filter(t => t.type === 'spending' && t.id !== id);
    localStorage.setItem('driver_spending_transactions', JSON.stringify(spendingTransactions));
    
    toast.success(t('driverEarnings.messages.transaction_deleted'));
  };

  const getFilteredTransactions = () => {
    let filtered = [...transactions];
    
    if (transactionType !== 'all') {
      filtered = filtered.filter(t => t.type === transactionType);
    }
    
    const days = parseInt(selectedPeriod);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    filtered = filtered.filter(t => new Date(t.date) >= cutoffDate);
    
    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return filtered;
  };

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'payout') return <ArrowDownLeft className="h-4 w-4 text-red-600" />;
    if (type === 'spending') return <ArrowDownLeft className="h-4 w-4 text-orange-600" />;
    if (amount < 0) return <ArrowDownLeft className="h-4 w-4 text-red-600" />;
    if (type === 'bonus') return <Gift className="h-4 w-4 text-purple-600" />;
    return <ArrowUpRight className="h-4 w-4 text-green-600" />;
  };

  const getTransactionTypeLabel = (type: string) => {
    switch(type) {
      case 'earning': return t('driverEarnings.transaction_types.earning');
      case 'payout': return t('driverEarnings.transaction_types.payout');
      case 'fee': return t('driverEarnings.transaction_types.fee');
      case 'bonus': return t('driverEarnings.transaction_types.bonus');
      case 'spending': return t('driverEarnings.transaction_types.spending');
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return t('driverEarnings.status.completed');
      case 'pending': return t('driverEarnings.status.pending');
      case 'processing': return t('driverEarnings.status.processing');
      case 'failed': return t('driverEarnings.status.failed');
      default: return status;
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch(category) {
      case 'fuel': return <Fuel className="h-4 w-4" />;
      case 'food': return <Utensils className="h-4 w-4" />;
      case 'maintenance': return <Car className="h-4 w-4" />;
      case 'supplies': return <ShoppingBag className="h-4 w-4" />;
      default: return <Coffee className="h-4 w-4" />;
    }
  };

  const getCategoryName = (category?: string) => {
    switch(category) {
      case 'fuel': return t('driverEarnings.categories.fuel');
      case 'food': return t('driverEarnings.categories.food');
      case 'maintenance': return t('driverEarnings.categories.maintenance');
      case 'supplies': return t('driverEarnings.categories.supplies');
      default: return t('driverEarnings.categories.other');
    }
  };

  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case 'bank': return <Building2 className="h-5 w-5 text-blue-600" />;
      case 'cash': return <Banknote className="h-5 w-5 text-green-600" />;
      case 'digital_wallet': return <Smartphone className="h-5 w-5 text-purple-600" />;
      default: return <Wallet className="h-5 w-5 text-gray-600" />;
    }
  };

  const spendingCategories = [
    { name: t('driverEarnings.categories.fuel'), icon: <Fuel className="h-4 w-4" />, budget: 400, spent: Math.abs(transactions.filter(t => t.category === 'fuel').reduce((sum, t) => sum + (t.amount || 0), 0)), color: 'bg-orange-500', key: 'fuel' },
    { name: t('driverEarnings.categories.food'), icon: <Utensils className="h-4 w-4" />, budget: 300, spent: Math.abs(transactions.filter(t => t.category === 'food').reduce((sum, t) => sum + (t.amount || 0), 0)), color: 'bg-green-500', key: 'food' },
    { name: t('driverEarnings.categories.maintenance'), icon: <Car className="h-4 w-4" />, budget: 200, spent: Math.abs(transactions.filter(t => t.category === 'maintenance').reduce((sum, t) => sum + (t.amount || 0), 0)), color: 'bg-red-500', key: 'maintenance' },
    { name: t('driverEarnings.categories.supplies'), icon: <ShoppingBag className="h-4 w-4" />, budget: 150, spent: Math.abs(transactions.filter(t => t.category === 'supplies').reduce((sum, t) => sum + (t.amount || 0), 0)), color: 'bg-purple-500', key: 'supplies' },
    { name: t('driverEarnings.categories.other'), icon: <Coffee className="h-4 w-4" />, budget: 100, spent: Math.abs(transactions.filter(t => t.category === 'other').reduce((sum, t) => sum + (t.amount || 0), 0)), color: 'bg-gray-500', key: 'other' }
  ];

  const savingsProgress = (earningsData.currentSavings / earningsData.savingsGoal) * 100;

  if (loadingOrders) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('driverEarnings.messages.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('driverEarnings.title')}</h2>
          <p className="text-gray-600">{t('driverEarnings.subtitle')}</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setIsAddingSpending(true)} variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50">
            <ArrowDownLeft className="mr-2 h-4 w-4" />
            {t('driverEarnings.actions.add_spending')}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <DollarSign className="mr-2 h-4 w-4" />
                {t('driverEarnings.actions.withdraw_funds')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('driverEarnings.withdraw.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('driverEarnings.withdraw.available_balance')}: <span className="font-bold text-green-600">${earningsData.availableBalance.toFixed(2)}</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="withdraw-method">{t('driverEarnings.withdraw.payment_method')}</Label>
                  <Select value={selectedWithdrawMethod} onValueChange={setSelectedWithdrawMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('driverEarnings.withdraw.select_method')} />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.filter(p => p.type !== 'cash' && p.isActive).map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          <div className="flex items-center space-x-2">
                            {getPaymentMethodIcon(method.type)}
                            <span>{method.name} - {method.details}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="withdraw-amount">{t('driverEarnings.withdraw.amount')}</Label>
                  <Input
                    id="withdraw-amount"
                    type="number"
                    step="0.01"
                    min={earningsData.minimumPayout}
                    max={earningsData.availableBalance}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder={t('driverEarnings.withdraw.min_amount', { min: earningsData.minimumPayout })}
                  />
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• {t('driverEarnings.withdraw.minimum_info', { min: earningsData.minimumPayout })}</p>
                  <p>• {t('driverEarnings.withdraw.processing_time')}</p>
                  <p>• {t('driverEarnings.withdraw.no_fees')}</p>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('driverEarnings.actions.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleWithdraw}>
                  {t('driverEarnings.actions.process_withdrawal')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Real Statistics Cards based on actual data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('driverEarnings.stats.available_balance')}</p>
                <p className="text-3xl font-bold text-green-600">${earningsData.availableBalance.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">{t('driverEarnings.stats.from_deliveries', { count: driverOrders.filter(o => o.status === 'completed' || o.status === 'delivered').length })}</p>
              </div>
              <Wallet className="h-10 w-10 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('driverEarnings.stats.total_earned')}</p>
                <p className="text-3xl font-bold text-blue-600">${earningsData.totalEarnings.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{t('driverEarnings.stats.from_all_deliveries')}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('driverEarnings.stats.total_spent')}</p>
                <p className="text-3xl font-bold text-orange-600">${earningsData.totalSpent.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{t('driverEarnings.stats.on_expenses')}</p>
              </div>
              <ShoppingBag className="h-10 w-10 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('driverEarnings.stats.total_withdrawn')}</p>
                <p className="text-3xl font-bold text-purple-600">${earningsData.totalWithdrawn.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{t('driverEarnings.stats.to_bank')}</p>
              </div>
              <CreditCard className="h-10 w-10 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payments Alert */}
      {earningsData.pendingPayments > 0 && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">{t('driverEarnings.pending_payments.title')}</p>
                  <p className="text-sm text-yellow-700">{t('driverEarnings.pending_payments.message', { amount: earningsData.pendingPayments.toFixed(2) })}</p>
                </div>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">{t('driverEarnings.pending_payments.payout')}: {t(`driverEarnings.payout_schedule.${earningsData.payoutSchedule}`)}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Savings Goal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t('driverEarnings.savings_goal.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>${earningsData.currentSavings.toLocaleString()} {t('driverEarnings.savings_goal.saved')}</span>
              <span>{t('driverEarnings.savings_goal.goal')}: ${earningsData.savingsGoal.toLocaleString()}</span>
            </div>
            <Progress value={savingsProgress} className="h-3" />
            <p className="text-sm text-gray-600 mt-2">
              {earningsData.savingsGoal - earningsData.currentSavings > 0 
                ? t('driverEarnings.savings_goal.more_to_go', { amount: (earningsData.savingsGoal - earningsData.currentSavings).toLocaleString() })
                : t('driverEarnings.savings_goal.congratulations')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">{t('driverEarnings.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="transactions">{t('driverEarnings.tabs.transactions')}</TabsTrigger>
          <TabsTrigger value="spending">{t('driverEarnings.tabs.spending_analysis')}</TabsTrigger>
          <TabsTrigger value="payment-methods">{t('driverEarnings.tabs.payment_methods')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Earnings Summary */}
            <Card>
              <CardHeader>
                <CardTitle>{t('driverEarnings.overview.earnings_summary')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">{t('driverEarnings.overview.this_week')}</p>
                      <p className="text-xl font-bold text-blue-600">${earningsData.weeklyEarnings.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{driverOrders.filter(o => new Date(o.delivery_completed_at || o.created_at) >= new Date(Date.now() - 7*24*60*60*1000)).length} {t('driverEarnings.overview.deliveries')}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">{t('driverEarnings.overview.this_month')}</p>
                      <p className="text-xl font-bold text-green-600">${earningsData.monthlyEarnings.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{driverOrders.filter(o => new Date(o.delivery_completed_at || o.created_at) >= new Date(Date.now() - 30*24*60*60*1000)).length} {t('driverEarnings.overview.deliveries')}</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg col-span-2">
                      <p className="text-sm text-gray-600">{t('driverEarnings.overview.this_year')}</p>
                      <p className="text-xl font-bold text-purple-600">${earningsData.yearlyEarnings.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{driverOrders.filter(o => o.status === 'completed' || o.status === 'delivered').length} {t('driverEarnings.overview.total_deliveries')}</p>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">{t('driverEarnings.overview.completed_deliveries')}</span>
                      <span className="text-sm text-green-600">{driverOrders.filter(o => o.status === 'completed' || o.status === 'delivered').length}</span>
                    </div>
                    <Progress value={75} className="h-2" />
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">{t('driverEarnings.overview.next_payout')}:</span>
                        <span className="text-sm font-medium text-blue-600">
                          {new Date(earningsData.nextPayoutDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Deliveries */}
            <Card>
              <CardHeader>
                <CardTitle>{t('driverEarnings.overview.recent_deliveries')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  <div className="space-y-3">
                    {driverOrders
                      .filter(order => order.status === 'completed' || order.status === 'delivered')
                      .slice(0, 10)
                      .map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-center space-x-3">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <div>
                              <p className="text-sm font-medium">{order.order_number?.slice(-12)}</p>
                              <p className="text-xs text-gray-600">
                                {order.customer_info?.name} • {new Date(order.delivery_completed_at || order.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-green-600">
                              +${order.pricing?.estimated_usd?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                        </div>
                      ))}
                    {driverOrders.filter(o => o.status === 'completed' || o.status === 'delivered').length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        {t('driverEarnings.overview.no_deliveries_yet')}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle>{t('driverEarnings.transactions.title')}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Select value={transactionType} onValueChange={setTransactionType}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('driverEarnings.transactions.filters.all_types')}</SelectItem>
                      <SelectItem value="earning">{t('driverEarnings.transaction_types.earning')}</SelectItem>
                      <SelectItem value="payout">{t('driverEarnings.transaction_types.payout')}</SelectItem>
                      <SelectItem value="spending">{t('driverEarnings.transaction_types.spending')}</SelectItem>
                      <SelectItem value="bonus">{t('driverEarnings.transaction_types.bonus')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">{t('driverEarnings.transactions.filters.last_7_days')}</SelectItem>
                      <SelectItem value="30">{t('driverEarnings.transactions.filters.last_30_days')}</SelectItem>
                      <SelectItem value="90">{t('driverEarnings.transactions.filters.last_3_months')}</SelectItem>
                      <SelectItem value="365">{t('driverEarnings.transactions.filters.last_year')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getFilteredTransactions().map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      {getTransactionIcon(transaction.type, transaction.amount)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-medium">{transaction.description}</p>
                          <Badge className="text-xs">{getTransactionTypeLabel(transaction.type)}</Badge>
                          {transaction.category && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              {getCategoryIcon(transaction.category)} {getCategoryName(transaction.category)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>{new Date(transaction.date).toLocaleDateString()}</span>
                          <span>{transaction.paymentMethod}</span>
                          {transaction.orderId && <span>{t('driverEarnings.transactions.ref')}: {transaction.orderId.slice(-12)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className={`font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                        </p>
                        <Badge className={getStatusColor(transaction.status)}>
                          {getStatusLabel(transaction.status)}
                        </Badge>
                      </div>
                      {transaction.type === 'spending' && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-red-600"
                          onClick={() => handleDeleteTransaction(transaction.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {getFilteredTransactions().length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    {t('driverEarnings.transactions.no_transactions')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spending" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Spending by Category - Real Data */}
            <Card>
              <CardHeader>
                <CardTitle>{t('driverEarnings.spending.by_category')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {spendingCategories.map((category) => (
                    <div key={category.key} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {category.icon}
                          <span className="text-sm font-medium">{category.name}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-orange-600">${category.spent.toFixed(2)}</span>
                          <span className="text-gray-500"> / ${category.budget}</span>
                        </div>
                      </div>
                      <Progress 
                        value={(category.spent / category.budget) * 100} 
                        className={`h-2 ${category.color}`}
                      />
                    </div>
                  ))}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{t('driverEarnings.spending.total_spending')}</span>
                      <span className="text-lg font-bold text-orange-600">${earningsData.totalSpent.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Spending Tips */}
            <Card>
              <CardHeader>
                <CardTitle>{t('driverEarnings.spending.tips.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">{t('driverEarnings.spending.tips.fuel_efficiency.title')}</h4>
                    <p className="text-sm text-blue-700">{t('driverEarnings.spending.tips.fuel_efficiency.message')}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">{t('driverEarnings.spending.tips.maintenance.title')}</h4>
                    <p className="text-sm text-green-700">{t('driverEarnings.spending.tips.maintenance.message')}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-purple-900 mb-2">{t('driverEarnings.spending.tips.tax_deductions.title')}</h4>
                    <p className="text-sm text-purple-700">{t('driverEarnings.spending.tips.tax_deductions.message')}</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <h4 className="font-medium text-yellow-900 mb-2">{t('driverEarnings.spending.tips.profit_margin.title')}</h4>
                    <p className="text-sm text-yellow-700">
                      {t('driverEarnings.spending.tips.profit_margin.message')}
                      <strong className="ml-1">${(earningsData.totalEarnings - earningsData.totalSpent).toFixed(2)}</strong>
                      ({((1 - earningsData.totalSpent / earningsData.totalEarnings) * 100).toFixed(1)}% {t('driverEarnings.spending.tips.profit_margin.margin')})
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Spending List */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('driverEarnings.spending.recent')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {transactions
                      .filter(t => t.type === 'spending')
                      .slice(0, 10)
                      .map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            {getCategoryIcon(transaction.category)}
                            <div>
                              <p className="text-sm font-medium">{transaction.description}</p>
                              <p className="text-xs text-gray-600">
                                {new Date(transaction.date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-red-600">
                              -${Math.abs(transaction.amount).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    {transactions.filter(t => t.type === 'spending').length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        {t('driverEarnings.spending.no_spending')}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payment-methods" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{t('driverEarnings.payment_methods.title')}</CardTitle>
                <Button onClick={() => setIsAddingPayment(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('driverEarnings.payment_methods.add')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getPaymentMethodIcon(method.type)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{method.name}</h4>
                          {method.isDefault && (
                            <Badge variant="secondary">{t('driverEarnings.payment_methods.default')}</Badge>
                          )}
                          {!method.isActive && (
                            <Badge variant="destructive">{t('driverEarnings.payment_methods.inactive')}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{method.details}</p>
                        {method.type === 'bank' && method.accountHolder && (
                          <p className="text-xs text-gray-500">{t('driverEarnings.payment_methods.account_holder')}: {method.accountHolder}</p>
                        )}
                        {method.type === 'digital_wallet' && method.email && (
                          <p className="text-xs text-gray-500">{method.email}</p>
                        )}
                        {method.type === 'cash' && (
                          <p className="text-xs text-blue-600">{t('driverEarnings.payment_methods.cash_instruction')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cash Payment Instructions */}
              <Card className="mt-6 bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <Banknote className="h-6 w-6 text-green-600 mt-1" />
                    <div>
                      <h4 className="font-medium text-green-900">{t('driverEarnings.cash_instructions.title')}</h4>
                      <div className="text-sm text-green-700 mt-2 space-y-1">
                        <p>• {t('driverEarnings.cash_instructions.collect')}</p>
                        <p>• {t('driverEarnings.cash_instructions.receipt')}</p>
                        <p>• {t('driverEarnings.cash_instructions.report')}</p>
                        <p>• {t('driverEarnings.cash_instructions.safe')}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Spending Dialog */}
      <AlertDialog open={isAddingSpending} onOpenChange={setIsAddingSpending}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('driverEarnings.add_spending.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('driverEarnings.add_spending.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('driverEarnings.add_spending.category')}</Label>
              <Select value={spendingCategory} onValueChange={setSpendingCategory}>
                <SelectTrigger>
                  <SelectValue placeholder={t('driverEarnings.add_spending.select_category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fuel">{t('driverEarnings.categories.fuel')} ⛽</SelectItem>
                  <SelectItem value="food">{t('driverEarnings.categories.food')} 🍔</SelectItem>
                  <SelectItem value="maintenance">{t('driverEarnings.categories.maintenance')} 🔧</SelectItem>
                  <SelectItem value="supplies">{t('driverEarnings.categories.supplies')} 📦</SelectItem>
                  <SelectItem value="other">{t('driverEarnings.categories.other')} 💰</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('driverEarnings.add_spending.amount')}</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={spendingAmount}
                onChange={(e) => setSpendingAmount(e.target.value)}
                placeholder={t('driverEarnings.add_spending.amount_placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('driverEarnings.add_spending.description')}</Label>
              <Input
                value={spendingDescription}
                onChange={(e) => setSpendingDescription(e.target.value)}
                placeholder={t('driverEarnings.add_spending.description_placeholder')}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('driverEarnings.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddSpending}>
              {t('driverEarnings.actions.add_spending')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Payment Method Dialog */}
      <AlertDialog open={isAddingPayment} onOpenChange={setIsAddingPayment}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('driverEarnings.add_payment.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('driverEarnings.add_payment.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('driverEarnings.add_payment.payment_type')}</Label>
              <Select defaultValue="bank">
                <SelectTrigger>
                  <SelectValue placeholder={t('driverEarnings.add_payment.select_type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">{t('driverEarnings.add_payment.bank_account')}</SelectItem>
                  <SelectItem value="digital_wallet">{t('driverEarnings.add_payment.digital_wallet')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('driverEarnings.add_payment.account_name')}</Label>
              <Input placeholder={t('driverEarnings.add_payment.account_name_placeholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('driverEarnings.add_payment.account_details')}</Label>
              <Input placeholder={t('driverEarnings.add_payment.account_details_placeholder')} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('driverEarnings.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              toast.success(t('driverEarnings.messages.payment_method_added'));
              setIsAddingPayment(false);
            }}>
              {t('driverEarnings.actions.add_payment_method')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}