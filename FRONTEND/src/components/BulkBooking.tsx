import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Upload, Download, FileSpreadsheet, MapPin, Truck, Calculator, CheckCircle } from 'lucide-react';
import { useLanguage } from './LanguageContext';

interface BulkOrder {
  id: string;
  pickup: string;
  delivery: string;
  weight: number;
  volume: number;
  category: string;
  urgency: string;
  estimatedCost: number;
  assignedDriver?: string;
  status: 'pending' | 'optimized' | 'assigned';
}

interface OptimizationResult {
  totalOrders: number;
  requiredVehicles: number;
  totalDistance: number;
  totalCost: number;
  fuelSavings: number;
  co2Reduction: number;
  routes: {
    driverId: string;
    driverName: string;
    vehicle: string;
    orders: string[];
    distance: number;
    cost: number;
    utilization: number;
  }[];
}

export function BulkBooking() {
  const { t } = useLanguage();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [orders, setOrders] = useState<BulkOrder[]>([]);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [step, setStep] = useState(1); // 1: Upload, 2: Review, 3: Optimize, 4: Confirm

  const mockOrders: BulkOrder[] = [
    {
      id: 'B001',
      pickup: '123 Main St, Downtown',
      delivery: '456 Oak Ave, Uptown',
      weight: 50,
      volume: 2.0,
      category: 'furniture',
      urgency: 'standard',
      estimatedCost: 45,
      status: 'pending'
    },
    {
      id: 'B002',
      pickup: '789 Pine Rd, Downtown',
      delivery: '321 Elm St, Midtown',
      weight: 25,
      volume: 1.2,
      category: 'electronics',
      urgency: 'urgent',
      estimatedCost: 35,
      status: 'pending'
    },
    {
      id: 'B003',
      pickup: '555 Broadway, Downtown',
      delivery: '888 Fifth Ave, Uptown',
      weight: 75,
      volume: 3.5,
      category: 'construction',
      urgency: 'standard',
      estimatedCost: 65,
      status: 'pending'
    },
    {
      id: 'B004',
      pickup: '999 First St, Downtown',
      delivery: '111 Second Ave, Eastside',
      weight: 30,
      volume: 1.8,
      category: 'documents',
      urgency: 'standard',
      estimatedCost: 30,
      status: 'pending'
    }
  ];

  const mockOptimization: OptimizationResult = {
    totalOrders: 4,
    requiredVehicles: 2,
    totalDistance: 45.2,
    totalCost: 145,
    fuelSavings: 35,
    co2Reduction: 12.5,
    routes: [
      {
        driverId: 'D001',
        driverName: 'Mike Johnson',
        vehicle: 'Ford Transit 350',
        orders: ['B001', 'B003'],
        distance: 28.5,
        cost: 85,
        utilization: 85
      },
      {
        driverId: 'D002',
        driverName: 'Sarah Williams',
        vehicle: 'Mercedes Sprinter',
        orders: ['B002', 'B004'],
        distance: 16.7,
        cost: 60,
        utilization: 70
      }
    ]
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // Mock processing of uploaded file
      setTimeout(() => {
        setOrders(mockOrders);
        setStep(2);
      }, 1500);
    }
  };

  const handleOptimize = () => {
    // Mock optimization process
    setOptimization(mockOptimization);
    setOrders(orders.map(order => ({ ...order, status: 'optimized' })));
    setStep(3);
  };

  const handleConfirmBooking = () => {
    setOrders(orders.map(order => ({ ...order, status: 'assigned' })));
    setStep(4);
  };

  const downloadTemplate = () => {
    // Mock download functionality
    alert(t('customer.bulk.template_downloaded') || 'Excel template downloaded! Fill in: Pickup Address, Delivery Address, Weight (kg), Volume (m³), Category, Urgency');
  };

  if (step === 4) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-green-600 flex items-center justify-center gap-2">
            <CheckCircle className="h-6 w-6" />
            {t('customer.bulk.booking_confirmed') || 'Bulk Booking Confirmed!'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl text-blue-600">{optimization?.totalOrders}</p>
              <p className="text-sm text-gray-600">
                {t('customer.bulk.orders_placed') || 'Orders Placed'}
              </p>
            </div>
            <div>
              <p className="text-2xl text-green-600">{optimization?.requiredVehicles}</p>
              <p className="text-sm text-gray-600">
                {t('customer.bulk.vehicles_assigned') || 'Vehicles Assigned'}
              </p>
            </div>
            <div>
              <p className="text-2xl text-purple-600">${optimization?.totalCost}</p>
              <p className="text-sm text-gray-600">
                {t('customer.bulk.total_cost') || 'Total Cost'}
              </p>
            </div>
            <div>
              <p className="text-2xl text-orange-600">{optimization?.fuelSavings}%</p>
              <p className="text-sm text-gray-600">
                {t('customer.bulk.fuel_savings') || 'Fuel Savings'}
              </p>
            </div>
          </div>
          <Button onClick={() => {setStep(1); setOrders([]); setOptimization(null); setUploadedFile(null)}}>
            {t('customer.bulk.upload_another_batch') || 'Upload Another Batch'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 3 && optimization) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              {t('customer.bulk.optimization_results') || 'Optimization Results'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <div className="text-center">
                <p className="text-2xl text-blue-600">{optimization.totalOrders}</p>
                <p className="text-sm text-gray-600">
                  {t('customer.bulk.total_orders') || 'Total Orders'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl text-green-600">{optimization.requiredVehicles}</p>
                <p className="text-sm text-gray-600">
                  {t('customer.bulk.vehicles_needed') || 'Vehicles Needed'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl text-purple-600">{optimization.totalDistance} km</p>
                <p className="text-sm text-gray-600">
                  {t('customer.bulk.total_distance') || 'Total Distance'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl text-orange-600">${optimization.totalCost}</p>
                <p className="text-sm text-gray-600">
                  {t('customer.bulk.total_cost') || 'Total Cost'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl text-emerald-600">{optimization.fuelSavings}%</p>
                <p className="text-sm text-gray-600">
                  {t('customer.bulk.fuel_savings') || 'Fuel Savings'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl text-cyan-600">{optimization.co2Reduction} kg</p>
                <p className="text-sm text-gray-600">
                  {t('customer.bulk.co2_reduced') || 'CO₂ Reduced'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">
                {t('customer.bulk.optimized_routes') || 'Optimized Routes'}
              </h4>
              {optimization.routes.map((route, index) => (
                <Card key={route.driverId}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h5 className="font-medium">{route.driverName}</h5>
                        <p className="text-sm text-gray-600">{route.vehicle}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg text-green-600">${route.cost}</p>
                        <p className="text-sm text-gray-600">{route.distance} km</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex space-x-2">
                        {route.orders.map(orderId => (
                          <Badge key={orderId} variant="secondary">{orderId}</Badge>
                        ))}
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">
                          {t('customer.bulk.utilization') || 'Utilization'}: 
                        </span>
                        <span className="font-medium text-blue-600"> {route.utilization}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(2)}>
            {t('customer.bulk.back_to_review') || 'Back to Review'}
          </Button>
          <Button onClick={handleConfirmBooking} className="bg-green-600 hover:bg-green-700">
            {t('customer.bulk.confirm_booking') || 'Confirm Booking'}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 2 && orders.length > 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {t('customer.bulk.review_orders', { count: orders.length.toString() }) || `Review Orders (${orders.length})`}
            </CardTitle>
            <p className="text-gray-600">
              {t('customer.bulk.review_description') || 'Review and edit your bulk orders before optimization'}
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('customer.bulk.order_id') || 'Order ID'}</TableHead>
                    <TableHead>{t('customer.bulk.pickup') || 'Pickup'}</TableHead>
                    <TableHead>{t('customer.bulk.delivery') || 'Delivery'}</TableHead>
                    <TableHead>{t('customer.bulk.weight') || 'Weight'}</TableHead>
                    <TableHead>{t('customer.bulk.volume') || 'Volume'}</TableHead>
                    <TableHead>{t('customer.bulk.category') || 'Category'}</TableHead>
                    <TableHead>{t('customer.bulk.cost') || 'Cost'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.id}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{order.pickup}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{order.delivery}</TableCell>
                      <TableCell>{order.weight} kg</TableCell>
                      <TableCell>{order.volume} m³</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{order.category}</Badge>
                      </TableCell>
                      <TableCell className="text-green-600">${order.estimatedCost}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">
                {t('customer.bulk.summary') || 'Summary'}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">
                    {t('customer.bulk.total_orders') || 'Total Orders'}:
                  </span>
                  <p className="font-medium">{orders.length}</p>
                </div>
                <div>
                  <span className="text-blue-700">
                    {t('customer.bulk.total_weight') || 'Total Weight'}:
                  </span>
                  <p className="font-medium">{orders.reduce((sum, order) => sum + order.weight, 0)} kg</p>
                </div>
                <div>
                  <span className="text-blue-700">
                    {t('customer.bulk.total_volume') || 'Total Volume'}:
                  </span>
                  <p className="font-medium">{orders.reduce((sum, order) => sum + order.volume, 0)} m³</p>
                </div>
                <div>
                  <span className="text-blue-700">
                    {t('customer.bulk.estimated_cost') || 'Estimated Cost'}:
                  </span>
                  <p className="font-medium text-green-600">
                    ${orders.reduce((sum, order) => sum + order.estimatedCost, 0)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(1)}>
            {t('customer.bulk.upload_different_file') || 'Upload Different File'}
          </Button>
          <Button onClick={handleOptimize} className="bg-blue-600 hover:bg-blue-700">
            <Calculator className="mr-2 h-4 w-4" />
            {t('customer.bulk.optimize_routes') || 'Optimize Routes'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          {t('customer.bulk.title') || 'Bulk Order Upload'}
        </CardTitle>
        <p className="text-gray-600">
          {t('customer.bulk.subtitle') || 'Upload multiple orders at once using an Excel file'}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Download Template */}
        <div className="border-2 border-dashed border-blue-200 rounded-lg p-6 text-center">
          <Download className="mx-auto h-8 w-8 text-blue-500 mb-3" />
          <h4 className="font-medium mb-2">
            {t('customer.bulk.need_template') || 'Need a template?'}
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            {t('customer.bulk.template_description') || 'Download our Excel template with the required format'}
          </p>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            {t('customer.bulk.download_template') || 'Download Template'}
          </Button>
        </div>

        {/* File Upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h4 className="text-lg font-medium mb-2">
            {t('customer.bulk.upload_excel_file') || 'Upload your Excel file'}
          </h4>
          <p className="text-gray-600 mb-4">
            {t('customer.bulk.file_support') || 'Support for .xlsx, .xls files up to 10MB'}
          </p>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload">
            <Button className="bg-blue-600 hover:bg-blue-700">
              {t('customer.bulk.choose_file') || 'Choose File'}
            </Button>
          </label>
          {uploadedFile && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <p className="text-green-800">
                {t('customer.bulk.uploaded', { filename: uploadedFile.name }) || `Uploaded: ${uploadedFile.name}`}
              </p>
              <p className="text-sm text-green-600">
                {t('customer.bulk.processing') || 'Processing...'}
              </p>
            </div>
          )}
        </div>

        {/* Required Format */}
        <div className="space-y-3">
          <h4 className="font-medium">
            {t('customer.bulk.required_excel_format') || 'Required Excel Format:'}
          </h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h5 className="font-medium mb-2">
                  {t('customer.bulk.required_columns') || 'Required Columns:'}
                </h5>
                <ul className="space-y-1 text-gray-600">
                  <li>• {t('customer.bulk.column_pickup') || 'Pickup Address'}</li>
                  <li>• {t('customer.bulk.column_delivery') || 'Delivery Address'}</li>
                  <li>• {t('customer.bulk.column_weight') || 'Weight (kg)'}</li>
                  <li>• {t('customer.bulk.column_volume') || 'Volume (m³)'}</li>
                  <li>• {t('customer.bulk.column_category') || 'Category'}</li>
                  <li>• {t('customer.bulk.column_urgency') || 'Urgency (standard/urgent)'}</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium mb-2">
                  {t('customer.bulk.supported_categories') || 'Supported Categories:'}
                </h5>
                <ul className="space-y-1 text-gray-600">
                  <li>• {t('customer.bulk.category_documents') || 'Documents'}</li>
                  <li>• {t('customer.bulk.category_furniture') || 'Furniture'}</li>
                  <li>• {t('customer.bulk.category_construction') || 'Construction'}</li>
                  <li>• {t('customer.bulk.category_electronics') || 'Electronics'}</li>
                  <li>• {t('customer.bulk.category_food') || 'Food & Beverages'}</li>
                  <li>• {t('customer.bulk.category_other') || 'Other'}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">
            {t('customer.bulk.benefits_title') || 'Bulk Booking Benefits:'}
          </h4>
          <ul className="space-y-1 text-sm text-blue-700">
            <li>• {t('customer.bulk.benefit_1') || 'Automatic route optimization'}</li>
            <li>• {t('customer.bulk.benefit_2') || 'Volume discounts available'}</li>
            <li>• {t('customer.bulk.benefit_3') || 'Efficient vehicle utilization'}</li>
            <li>• {t('customer.bulk.benefit_4') || 'Reduced delivery costs'}</li>
            <li>• {t('customer.bulk.benefit_5') || 'Environmental impact reduction'}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}