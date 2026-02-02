import React, { useState } from 'react';
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
import { DollarSign, CreditCard, Building2, Wallet, TrendingUp, Calendar, Clock, CheckCircle, AlertCircle, ArrowUpRight, ArrowDownLeft, Plus, Banknote, Smartphone } from 'lucide-react';

interface PaymentMethod {
  id: string;
  type: 'bank' | 'cash' | 'digital_wallet';
  name: string;
  details: string;
  isDefault: boolean;
  isActive: boolean;
}

interface Transaction {
  id: string;
  orderId: string;
  amount: number;
  type: 'earning' | 'payout' | 'fee' | 'bonus';
  status: 'completed' | 'pending' | 'processing' | 'failed';
  paymentMethod: string;
  date: string;
  description: string;
  customerName?: string;
}

interface EarningsData {
  totalEarnings: number;
  availableBalance: number;
  pendingPayments: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  totalWithdrawn: number;
  payoutSchedule: 'instant' | 'daily' | 'weekly';
  nextPayoutDate: string;
  minimumPayout: number;
}

export function DriverEarnings() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [selectedWithdrawMethod, setSelectedWithdrawMethod] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    {
      id: 'BANK001',
      type: 'bank',
      name: 'Chase Bank',
      details: 'Account ending in 4567',
      isDefault: true,
      isActive: true
    },
    {
      id: 'CASH001',
      type: 'cash',
      name: 'Cash Payments',
      details: 'Collect cash directly from customers',
      isDefault: false,
      isActive: true
    },
    {
      id: 'WALLET001',
      type: 'digital_wallet',
      name: 'PayPal',
      details: 'mike.driver@email.com',
      isDefault: false,
      isActive: true
    }
  ]);

  const [earningsData] = useState<EarningsData>({
    totalEarnings: 12470,
    availableBalance: 485,
    pendingPayments: 125,
    weeklyEarnings: 312,
    monthlyEarnings: 1247,
    totalWithdrawn: 11985,
    payoutSchedule: 'daily',
    nextPayoutDate: '2024-12-04',
    minimumPayout: 10
  });

  const [transactions] = useState<Transaction[]>([
    {
      id: 'TXN001',
      orderId: 'ORD-1234',
      amount: 45.50,
      type: 'earning',
      status: 'completed',
      paymentMethod: 'Cash',
      date: '2024-12-03T14:30:00Z',
      description: 'Delivery payment',
      customerName: 'John Smith'
    },
    {
      id: 'TXN002',
      orderId: 'ORD-1235',
      amount: 32.75,
      type: 'earning',
      status: 'pending',
      paymentMethod: 'Bank Transfer',
      date: '2024-12-03T16:15:00Z',
      description: 'Delivery payment - processing',
      customerName: 'Sarah Johnson'
    },
    {
      id: 'TXN003',
      orderId: 'WITHDRAW-001',
      amount: -200.00,
      type: 'payout',
      status: 'completed',
      paymentMethod: 'Chase Bank',
      date: '2024-12-02T09:00:00Z',
      description: 'Weekly payout'
    },
    {
      id: 'TXN004',
      orderId: 'ORD-1230',
      amount: 67.25,
      type: 'earning',
      status: 'completed',
      paymentMethod: 'Cash',
      date: '2024-12-02T11:45:00Z',
      description: 'Delivery payment + tip',
      customerName: 'Mike Wilson'
    },
    {
      id: 'TXN005',
      orderId: 'BONUS-001',
      amount: 25.00,
      type: 'bonus',
      status: 'completed',
      paymentMethod: 'Bank Transfer',
      date: '2024-12-01T18:00:00Z',
      description: 'Weekly delivery bonus'
    },
    {
      id: 'TXN006',
      orderId: 'FEE-001',
      amount: -2.50,
      type: 'fee',
      status: 'completed',
      paymentMethod: 'Bank Transfer',
      date: '2024-12-01T18:00:00Z',
      description: 'Platform service fee'
    }
  ]);

  const handleWithdraw = () => {
    if (!selectedWithdrawMethod || !withdrawAmount) return;
    
    const amount = parseFloat(withdrawAmount);
    if (amount < earningsData.minimumPayout) {
      alert(`Minimum withdrawal amount is $${earningsData.minimumPayout}`);
      return;
    }
    if (amount > earningsData.availableBalance) {
      alert('Insufficient balance');
      return;
    }

    // Mock withdrawal processing
    alert(`Withdrawal of $${amount} initiated to ${paymentMethods.find(p => p.id === selectedWithdrawMethod)?.name}`);
    setWithdrawAmount('');
    setSelectedWithdrawMethod('');
  };

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'payout') return <ArrowDownLeft className="h-4 w-4 text-red-600" />;
    if (amount < 0) return <ArrowDownLeft className="h-4 w-4 text-red-600" />;
    return <ArrowUpRight className="h-4 w-4 text-green-600" />;
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

  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case 'bank': return <Building2 className="h-5 w-5 text-blue-600" />;
      case 'cash': return <Banknote className="h-5 w-5 text-green-600" />;
      case 'digital_wallet': return <Smartphone className="h-5 w-5 text-purple-600" />;
      default: return <Wallet className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl text-gray-900">Earnings & Payments</h2>
          <p className="text-gray-600">Manage your earnings and payment methods</p>
        </div>
        <div className="flex space-x-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <DollarSign className="mr-2 h-4 w-4" />
                Withdraw Funds
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Withdraw Earnings</AlertDialogTitle>
                <AlertDialogDescription>
                  Available balance: ${earningsData.availableBalance.toFixed(2)}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="withdraw-method">Payment Method</Label>
                  <Select value={selectedWithdrawMethod} onValueChange={setSelectedWithdrawMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
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
                  <Label htmlFor="withdraw-amount">Amount ($)</Label>
                  <Input
                    id="withdraw-amount"
                    type="number"
                    step="0.01"
                    min={earningsData.minimumPayout}
                    max={earningsData.availableBalance}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder={`Min: $${earningsData.minimumPayout}`}
                  />
                </div>
                <div className="text-sm text-gray-600">
                  <p>• Minimum withdrawal: ${earningsData.minimumPayout}</p>
                  <p>• Processing time: 1-3 business days</p>
                  <p>• No withdrawal fees for bank transfers</p>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleWithdraw}>
                  Process Withdrawal
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available Balance</p>
                <p className="text-2xl text-green-600">${earningsData.availableBalance.toFixed(2)}</p>
              </div>
              <Wallet className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Payments</p>
                <p className="text-2xl text-yellow-600">${earningsData.pendingPayments.toFixed(2)}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-2xl text-blue-600">${earningsData.weeklyEarnings.toFixed(2)}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Earned</p>
                <p className="text-2xl text-purple-600">${earningsData.totalEarnings.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transaction History</TabsTrigger>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Processing Flow */}
            <Card>
              <CardHeader>
                <CardTitle>How You Get Paid</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">1</div>
                    <div>
                      <h4 className="font-medium">Complete Delivery</h4>
                      <p className="text-sm text-gray-600">Customer confirms delivery and payment is processed</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">2</div>
                    <div>
                      <h4 className="font-medium">Payment Options</h4>
                      <div className="text-sm text-gray-600">
                        <p>• <strong>Cash:</strong> Keep immediately (report in app)</p>
                        <p>• <strong>Card/Digital:</strong> Added to your balance</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">3</div>
                    <div>
                      <h4 className="font-medium">Automatic Payouts</h4>
                      <p className="text-sm text-gray-600">
                        {earningsData.payoutSchedule === 'daily' ? 'Daily automatic transfers to your bank' : 
                         earningsData.payoutSchedule === 'weekly' ? 'Weekly automatic transfers to your bank' : 
                         'Instant transfers available'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Next Payout:</span>
                    <span className="text-sm text-blue-600">{new Date(earningsData.nextPayoutDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {transactions.slice(0, 5).map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getTransactionIcon(transaction.type, transaction.amount)}
                          <div>
                            <p className="text-sm font-medium">
                              {transaction.customerName || transaction.description}
                            </p>
                            <p className="text-xs text-gray-600">
                              {new Date(transaction.date).toLocaleDateString()} • {transaction.paymentMethod}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                          </p>
                          <Badge className={`text-xs ${getStatusColor(transaction.status)}`}>
                            {transaction.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Transaction History</CardTitle>
                <div className="flex space-x-2">
                  <Select defaultValue="all">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="earning">Earnings</SelectItem>
                      <SelectItem value="payout">Payouts</SelectItem>
                      <SelectItem value="bonus">Bonuses</SelectItem>
                      <SelectItem value="fee">Fees</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue="30">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 3 months</SelectItem>
                      <SelectItem value="365">Last year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      {getTransactionIcon(transaction.type, transaction.amount)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-medium">{transaction.description}</p>
                          {transaction.customerName && (
                            <span className="text-sm text-gray-600">• {transaction.customerName}</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>{new Date(transaction.date).toLocaleDateString()}</span>
                          <span>{transaction.paymentMethod}</span>
                          <span>Order: {transaction.orderId}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                      </p>
                      <Badge className={getStatusColor(transaction.status)}>
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment-methods">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Payment Methods</CardTitle>
                <Button onClick={() => setIsAddingPayment(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Payment Method
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
                            <Badge variant="secondary">Default</Badge>
                          )}
                          {!method.isActive && (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{method.details}</p>
                        {method.type === 'cash' && (
                          <p className="text-xs text-blue-600">Report cash payments after each delivery</p>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                      {method.type !== 'cash' && (
                        <Button variant="outline" size="sm">
                          {method.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      )}
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
                      <h4 className="font-medium text-green-900">Cash Payment Instructions</h4>
                      <div className="text-sm text-green-700 mt-2 space-y-1">
                        <p>• Collect cash payment directly from customers</p>
                        <p>• Always provide a receipt if requested</p>
                        <p>• Report cash earnings in the app immediately after delivery</p>
                        <p>• Keep cash safe and deposit regularly</p>
                        <p>• Cash earnings are added to your total but don't require withdrawal</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Payment Method Dialog */}
      {isAddingPayment && (
        <AlertDialog open={isAddingPayment} onOpenChange={setIsAddingPayment}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Add Payment Method</AlertDialogTitle>
              <AlertDialogDescription>
                Add a new way to receive your earnings
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="digital_wallet">Digital Wallet (PayPal, etc.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input placeholder="Enter account name" />
              </div>
              <div className="space-y-2">
                <Label>Account Details</Label>
                <Input placeholder="Account number or email" />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Add Payment Method</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}