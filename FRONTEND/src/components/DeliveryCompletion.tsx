import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { CheckCircle, DollarSign, CreditCard, Banknote, Camera, MapPin, Clock, User, Package, Star, AlertTriangle } from 'lucide-react';

interface DeliveryOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  packageDescription: string;
  estimatedEarning: number;
  paymentMethod: 'cash' | 'card' | 'digital';
  deliveryInstructions?: string;
  packageWeight: number;
  packageDimensions: string;
}

interface DeliveryCompletionProps {
  order: DeliveryOrder;
  onComplete: (completionData: any) => void;
  onCancel: () => void;
}

export function DeliveryCompletion({ order, onComplete, onCancel }: DeliveryCompletionProps) {
  const [completionStep, setCompletionStep] = useState(1);
  const [deliveryProof, setDeliveryProof] = useState<File | null>(null);
  const [customerSignature, setCustomerSignature] = useState<string>('');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [tipAmount, setTipAmount] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [customerRating, setCustomerRating] = useState<number>(5);
  const [issuesReported, setIssuesReported] = useState<string[]>([]);
  const [confirmationCode, setConfirmationCode] = useState<string>('');

  // Generate a random confirmation code when component mounts
  React.useEffect(() => {
    setConfirmationCode(Math.random().toString(36).substr(2, 6).toUpperCase());
  }, []);

  const handleIssueToggle = (issue: string) => {
    setIssuesReported(prev => 
      prev.includes(issue) 
        ? prev.filter(i => i !== issue)
        : [...prev, issue]
    );
  };

  const handleCompleteDelivery = () => {
    const completionData = {
      orderId: order.id,
      completedAt: new Date().toISOString(),
      paymentMethod: order.paymentMethod,
      baseEarning: order.estimatedEarning,
      tipAmount: parseFloat(tipAmount) || 0,
      totalEarning: order.estimatedEarning + (parseFloat(tipAmount) || 0),
      cashReceived: order.paymentMethod === 'cash' ? parseFloat(cashReceived) || 0 : 0,
      customerRating,
      deliveryProof,
      customerSignature,
      deliveryNotes,
      issuesReported,
      confirmationCode,
      location: {
        lat: 40.7128,
        lng: -74.0060,
        timestamp: new Date().toISOString()
      }
    };

    // Process payment immediately based on method
    if (order.paymentMethod === 'cash') {
      // Cash payment - driver keeps immediately
      alert(`Cash payment received: $${completionData.totalEarning.toFixed(2)}\nPlease report this earning in your payment section.`);
    } else {
      // Digital payment - process through platform
      alert(`Payment processing: $${completionData.totalEarning.toFixed(2)}\nFunds will be added to your balance within 1-2 business days.`);
    }

    onComplete(completionData);
  };

  const renderPaymentIcon = () => {
    switch (order.paymentMethod) {
      case 'cash': return <Banknote className="h-5 w-5 text-green-600" />;
      case 'card': return <CreditCard className="h-5 w-5 text-blue-600" />;
      case 'digital': return <DollarSign className="h-5 w-5 text-purple-600" />;
      default: return <DollarSign className="h-5 w-5 text-gray-600" />;
    }
  };

  const renderStep = () => {
    switch (completionStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Package className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl mb-2">Confirm Delivery Location</h3>
              <p className="text-gray-600">Verify you're at the correct delivery address</p>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-blue-600 mt-1" />
                  <div>
                    <h4 className="font-medium text-blue-900">Delivery Address</h4>
                    <p className="text-blue-700">{order.deliveryAddress}</p>
                    {order.deliveryInstructions && (
                      <p className="text-sm text-blue-600 mt-1">
                        <strong>Instructions:</strong> {order.deliveryInstructions}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="location-confirmed" />
                <Label htmlFor="location-confirmed">I am at the correct delivery location</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="package-intact" />
                <Label htmlFor="package-intact">Package is in good condition</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="customer-present" />
                <Label htmlFor="customer-present">Customer is present or delivery authorized</Label>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Camera className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl mb-2">Delivery Verification</h3>
              <p className="text-gray-600">Provide proof of delivery</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="delivery-photo">Delivery Photo</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Camera className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-2">Take a photo of the delivered package</p>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setDeliveryProof(e.target.files?.[0] || null)}
                    className="hidden"
                    id="delivery-photo"
                  />
                  <label htmlFor="delivery-photo">
                    <Button variant="outline" className="cursor-pointer">
                      Take Photo
                    </Button>
                  </label>
                  {deliveryProof && (
                    <p className="text-sm text-green-600 mt-2">
                      ✓ Photo captured: {deliveryProof.name}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-signature">Customer Name/Signature (if present)</Label>
                <Input
                  id="customer-signature"
                  value={customerSignature}
                  onChange={(e) => setCustomerSignature(e.target.value)}
                  placeholder="Customer signature or 'Left at door'"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmation-code">Confirmation Code</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="confirmation-code"
                    value={confirmationCode}
                    disabled
                    className="bg-gray-50"
                  />
                  <Button variant="outline" onClick={() => navigator.clipboard.writeText(confirmationCode)}>
                    Copy
                  </Button>
                </div>
                <p className="text-sm text-gray-600">Share this code with the customer if requested</p>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              {renderPaymentIcon()}
              <h3 className="text-xl mb-2 mt-4">Payment Processing</h3>
              <p className="text-gray-600">Complete the payment process</p>
            </div>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium">Base Delivery Fee:</span>
                  <span className="text-lg font-medium text-green-600">${order.estimatedEarning.toFixed(2)}</span>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="tip-amount">Tip Amount (optional)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="tip-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={tipAmount}
                        onChange={(e) => setTipAmount(e.target.value)}
                        placeholder="0.00"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {order.paymentMethod === 'cash' && (
                    <div className="space-y-2">
                      <Label htmlFor="cash-received">Cash Received</Label>
                      <div className="relative">
                        <Banknote className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="cash-received"
                          type="number"
                          step="0.01"
                          min="0"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          placeholder={(order.estimatedEarning + (parseFloat(tipAmount) || 0)).toFixed(2)}
                          className="pl-10"
                        />
                      </div>
                      <p className="text-sm text-blue-600">
                        Expected: ${(order.estimatedEarning + (parseFloat(tipAmount) || 0)).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t pt-3 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium">Total Earning:</span>
                    <span className="text-xl font-medium text-green-600">
                      ${(order.estimatedEarning + (parseFloat(tipAmount) || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {order.paymentMethod === 'cash' ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Cash Payment Instructions</h4>
                    <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                      <li>• Collect the exact amount from the customer</li>
                      <li>• Provide a receipt if requested</li>
                      <li>• Report this earning in your payment section</li>
                      <li>• Keep cash secure until you can deposit it</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Digital Payment Processing</h4>
                    <ul className="text-sm text-blue-700 mt-1 space-y-1">
                      <li>• Payment is processed automatically</li>
                      <li>• Funds will be added to your balance</li>
                      <li>• Processing time: 1-2 business days</li>
                      <li>• You'll receive a notification when payment is complete</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Star className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
              <h3 className="text-xl mb-2">Rate This Delivery</h3>
              <p className="text-gray-600">How was your experience with this customer?</p>
            </div>

            <div className="space-y-4">
              <div className="text-center">
                <div className="flex justify-center space-x-2 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setCustomerRating(star)}
                      className={`p-1 ${star <= customerRating ? 'text-yellow-500' : 'text-gray-300'}`}
                    >
                      <Star className="h-8 w-8 fill-current" />
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-600">
                  {customerRating === 5 ? 'Excellent' : 
                   customerRating === 4 ? 'Good' : 
                   customerRating === 3 ? 'Average' : 
                   customerRating === 2 ? 'Poor' : 'Very Poor'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery-notes">Delivery Notes (optional)</Label>
                <Textarea
                  id="delivery-notes"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Any notes about this delivery..."
                  rows={3}
                />
              </div>

              <div className="space-y-3">
                <Label>Any issues during delivery? (optional)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Difficult to find address',
                    'Customer not available',
                    'Package damaged',
                    'Payment issues',
                    'Unsafe location',
                    'Parking problems'
                  ].map((issue) => (
                    <div key={issue} className="flex items-center space-x-2">
                      <Checkbox
                        id={issue}
                        checked={issuesReported.includes(issue)}
                        onCheckedChange={() => handleIssueToggle(issue)}
                      />
                      <Label htmlFor={issue} className="text-sm">{issue}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Complete Delivery</CardTitle>
              <p className="text-gray-600">Order ID: {order.id}</p>
            </div>
            <Badge variant="outline">
              Step {completionStep} of 4
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Order Summary */}
          <Card className="mb-6 bg-gray-50">
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Customer:</p>
                  <p>{order.customerName}</p>
                  <p>{order.customerPhone}</p>
                </div>
                <div>
                  <p className="font-medium">Package:</p>
                  <p>{order.packageDescription}</p>
                  <p>{order.packageWeight}kg • {order.packageDimensions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {renderStep()}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={completionStep === 1 ? onCancel : () => setCompletionStep(completionStep - 1)}
            >
              {completionStep === 1 ? 'Cancel' : 'Previous'}
            </Button>
            <Button
              onClick={completionStep === 4 ? handleCompleteDelivery : () => setCompletionStep(completionStep + 1)}
              className="bg-green-600 hover:bg-green-700"
            >
              {completionStep === 4 ? 'Complete Delivery' : 'Next'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Example usage component for demonstration
export function DeliveryCompletionDemo() {
  const [showCompletion, setShowCompletion] = useState(false);
  
  const mockOrder: DeliveryOrder = {
    id: 'ORD-1234',
    customerName: 'John Smith',
    customerPhone: '+1 (555) 123-4567',
    pickupAddress: '123 Store Street, Downtown',
    deliveryAddress: '456 Home Avenue, Apartment 2B, Uptown',
    packageDescription: 'Electronics - Laptop',
    estimatedEarning: 45.50,
    paymentMethod: 'cash',
    deliveryInstructions: 'Ring doorbell twice, leave at door if no answer',
    packageWeight: 2.5,
    packageDimensions: '40x30x5 cm'
  };

  const handleComplete = (completionData: any) => {
    console.log('Delivery completed:', completionData);
    setShowCompletion(false);
    // Process payment and update driver earnings here
  };

  if (showCompletion) {
    return (
      <DeliveryCompletion
        order={mockOrder}
        onComplete={handleComplete}
        onCancel={() => setShowCompletion(false)}
      />
    );
  }

  return (
    <div className="p-8">
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="text-lg mb-4">Delivery Completion Demo</h3>
            <Button onClick={() => setShowCompletion(true)}>
              Complete Delivery Demo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}