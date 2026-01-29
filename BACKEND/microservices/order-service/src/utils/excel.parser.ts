import * as XLSX from 'xlsx';
import { Logger } from './logger';

export interface ExcelParseOptions {
  sheetName?: string;
  headerRow?: number;
  skipRows?: number;
  expectedColumns?: string[];
  columnMappings?: Record<string, string>;
  validate?: (row: any) => boolean | string;
}

export interface ExcelParseResult {
  success: boolean;
  data: any[];
  errors: ParseError[];
  warnings: string[];
  metadata: {
    rowCount: number;
    columnCount: number;
    sheetNames: string[];
    parsedRows: number;
    skippedRows: number;
  };
}

export interface ParseError {
  row: number;
  column?: string;
  message: string;
  value?: any;
}

export interface BulkOrderTemplate {
  pickupAddress: string;
  deliveryAddress: string;
  recipientName?: string;
  recipientPhone?: string;
  packageDescription?: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  specialInstructions?: string;
  priority?: string;
  scheduledPickup?: string;
}

export class ExcelParser {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ExcelParser');
  }

  /**
   * Parse Excel file for bulk orders
   */
  async parseBulkOrderFile(
    fileBuffer: Buffer,
    options: ExcelParseOptions = {}
  ): Promise<ExcelParseResult> {
    try {
      this.logger.info('Parsing bulk order Excel file');

      // Read workbook
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetNames = workbook.SheetNames;

      if (sheetNames.length === 0) {
        throw new Error('Excel file contains no sheets');
      }

      // Use first sheet by default
      const sheetName = options.sheetName || sheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        throw new Error(`Sheet '${sheetName}' not found`);
      }

      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: true,
        defval: null
      });

      // Parse data with options
      const result = this.parseSheetData(jsonData, {
        headerRow: 1,
        expectedColumns: [
          'pickupAddress',
          'deliveryAddress',
          'recipientName',
          'recipientPhone',
          'packageDescription',
          'weight',
          'dimensionsLength',
          'dimensionsWidth',
          'dimensionsHeight',
          'specialInstructions',
          'priority',
          'scheduledPickup'
        ],
        columnMappings: {
          'Pickup Address': 'pickupAddress',
          'Delivery Address': 'deliveryAddress',
          'Recipient Name': 'recipientName',
          'Recipient Phone': 'recipientPhone',
          'Package Description': 'packageDescription',
          'Weight (kg)': 'weight',
          'Length (cm)': 'dimensionsLength',
          'Width (cm)': 'dimensionsWidth',
          'Height (cm)': 'dimensionsHeight',
          'Special Instructions': 'specialInstructions',
          'Priority': 'priority',
          'Scheduled Pickup': 'scheduledPickup'
        },
        ...options
      });

      // Validate each row
      const validatedData = this.validateBulkOrderData(result.data, result.errors);

      return {
        ...result,
        data: validatedData,
        metadata: {
          ...result.metadata,
          sheetNames,
          parsedRows: validatedData.length
        }
      };
    } catch (error) {
      this.logger.error('Failed to parse Excel file:', error);
      return {
        success: false,
        data: [],
        errors: [{
          row: 0,
          message: `Failed to parse Excel file: ${error.message}`
        }],
        warnings: [],
        metadata: {
          rowCount: 0,
          columnCount: 0,
          sheetNames: [],
          parsedRows: 0,
          skippedRows: 0
        }
      };
    }
  }

  /**
   * Generate Excel template for bulk orders
   */
  generateBulkOrderTemplate(): Buffer {
    try {
      this.logger.info('Generating bulk order template');

      // Create template data
      const templateData = [
        // Headers
        [
          'Pickup Address*',
          'Delivery Address*',
          'Recipient Name',
          'Recipient Phone',
          'Package Description',
          'Weight (kg)',
          'Length (cm)',
          'Width (cm)',
          'Height (cm)',
          'Special Instructions',
          'Priority (low/normal/high/urgent)',
          'Scheduled Pickup (YYYY-MM-DD HH:MM)'
        ],
        // Example row
        [
          '123 Main St, New York, NY',
          '456 Park Ave, Brooklyn, NY',
          'John Doe',
          '+1234567890',
          'Electronics package',
          '5.5',
          '40',
          '30',
          '20',
          'Fragile - handle with care',
          'normal',
          '2024-01-15 14:30'
        ],
        // Instructions
        [
          '* Required fields',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          ''
        ]
      ];

      // Create workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(templateData);

      // Set column widths
      const colWidths = [
        { wch: 30 }, // Pickup Address
        { wch: 30 }, // Delivery Address
        { wch: 20 }, // Recipient Name
        { wch: 15 }, // Recipient Phone
        { wch: 25 }, // Package Description
        { wch: 10 }, // Weight
        { wch: 10 }, // Length
        { wch: 10 }, // Width
        { wch: 10 }, // Height
        { wch: 25 }, // Special Instructions
        { wch: 20 }, // Priority
        { wch: 25 }  // Scheduled Pickup
      ];
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Bulk Orders Template');

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      return buffer;
    } catch (error) {
      this.logger.error('Failed to generate template:', error);
      throw new Error(`Failed to generate Excel template: ${error.message}`);
    }
  }

  /**
   * Parse order report data
   */
  async parseOrderReport(
    fileBuffer: Buffer,
    options: ExcelParseOptions = {}
  ): Promise<ExcelParseResult> {
    try {
      this.logger.info('Parsing order report Excel file');

      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = options.sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: true,
        defval: null
      });

      const result = this.parseSheetData(jsonData, {
        headerRow: 0,
        expectedColumns: [
          'orderNumber',
          'status',
          'customerId',
          'pickupAddress',
          'deliveryAddress',
          'totalPrice',
          'createdAt'
        ],
        ...options
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to parse order report:', error);
      throw error;
    }
  }

  /**
   * Generate order report in Excel format
   */
  generateOrderReport(orders: any[]): Buffer {
    try {
      this.logger.info(`Generating order report for ${orders.length} orders`);

      // Prepare data
      const headers = [
        'Order Number',
        'Status',
        'Customer ID',
        'Pickup Address',
        'Delivery Address',
        'Total Weight (kg)',
        'Total Volume (m³)',
        'Total Price ($)',
        'Driver Earnings ($)',
        'Platform Fee ($)',
        'Created Date',
        'Delivery Date'
      ];

      const rows = orders.map(order => [
        order.orderNumber,
        order.status,
        order.customerId,
        order.pickupAddress?.substring(0, 50) || '', // Truncate long addresses
        order.deliveryAddress?.substring(0, 50) || '',
        order.totalWeightKg || 0,
        order.totalVolumeM3 || 0,
        order.totalPrice || 0,
        order.driverEarnings || 0,
        order.platformFee || 0,
        order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '',
        order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString() : ''
      ]);

      const data = [headers, ...rows];

      // Create workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(data);

      // Set column widths
      const colWidths = [
        { wch: 15 }, // Order Number
        { wch: 15 }, // Status
        { wch: 15 }, // Customer ID
        { wch: 30 }, // Pickup Address
        { wch: 30 }, // Delivery Address
        { wch: 12 }, // Weight
        { wch: 12 }, // Volume
        { wch: 12 }, // Total Price
        { wch: 12 }, // Driver Earnings
        { wch: 12 }, // Platform Fee
        { wch: 15 }, // Created Date
        { wch: 15 }  // Delivery Date
      ];
      worksheet['!cols'] = colWidths;

      // Add worksheet
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders Report');

      // Generate buffer
      return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    } catch (error) {
      this.logger.error('Failed to generate order report:', error);
      throw new Error(`Failed to generate order report: ${error.message}`);
    }
  }

  /**
   * Parse sheet data with validation
   */
  private parseSheetData(
    sheetData: any[][],
    options: ExcelParseOptions
  ): ExcelParseResult {
    const errors: ParseError[] = [];
    const warnings: string[] = [];
    const data: any[] = [];

    if (!sheetData || sheetData.length === 0) {
      errors.push({ row: 0, message: 'Sheet is empty' });
      return {
        success: false,
        data,
        errors,
        warnings,
        metadata: {
          rowCount: 0,
          columnCount: 0,
          sheetNames: [],
          parsedRows: 0,
          skippedRows: 0
        }
      };
    }

    const headerRow = Math.max(0, (options.headerRow || 1) - 1);
    const skipRows = options.skipRows || 0;
    const startRow = Math.max(headerRow + 1, skipRows);

    // Extract headers
    const rawHeaders = sheetData[headerRow] || [];
    const headers = this.normalizeHeaders(rawHeaders, options.columnMappings);

    // Validate expected columns
    if (options.expectedColumns) {
      const missingColumns = options.expectedColumns.filter(col => 
        !headers.includes(col) && !Object.values(options.columnMappings || {}).includes(col)
      );
      
      if (missingColumns.length > 0) {
        warnings.push(`Missing expected columns: ${missingColumns.join(', ')}`);
      }
    }

    // Process data rows
    let skippedRows = 0;
    for (let i = startRow; i < sheetData.length; i++) {
      const row = sheetData[i];
      
      // Skip empty rows
      if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) {
        skippedRows++;
        continue;
      }

      // Convert row to object
      const rowObject: any = {};
      for (let j = 0; j < headers.length; j++) {
        if (headers[j]) {
          rowObject[headers[j]] = this.cleanCellValue(row[j]);
        }
      }

      // Apply custom validation
      if (options.validate) {
        const validationResult = options.validate(rowObject);
        if (validationResult !== true) {
          errors.push({
            row: i + 1,
            message: typeof validationResult === 'string' ? validationResult : 'Row validation failed',
            value: rowObject
          });
          continue;
        }
      }

      data.push(rowObject);
    }

    const success = errors.length === 0;

    return {
      success,
      data,
      errors,
      warnings,
      metadata: {
        rowCount: sheetData.length,
        columnCount: headers.length,
        sheetNames: [],
        parsedRows: data.length,
        skippedRows
      }
    };
  }

  /**
   * Validate bulk order data
   */
  private validateBulkOrderData(data: any[], errors: ParseError[]): any[] {
    const validatedData: any[] = [];

    data.forEach((row, index) => {
      const rowErrors: ParseError[] = [];

      // Validate required fields
      if (!row.pickupAddress || !row.pickupAddress.trim()) {
        rowErrors.push({
          row: index + 2, // +2 because Excel rows are 1-indexed and we have header
          column: 'pickupAddress',
          message: 'Pickup address is required',
          value: row.pickupAddress
        });
      }

      if (!row.deliveryAddress || !row.deliveryAddress.trim()) {
        rowErrors.push({
          row: index + 2,
          column: 'deliveryAddress',
          message: 'Delivery address is required',
          value: row.deliveryAddress
        });
      }

      // Validate weight
      if (row.weight !== undefined && row.weight !== null) {
        const weight = parseFloat(row.weight);
        if (isNaN(weight) || weight <= 0) {
          rowErrors.push({
            row: index + 2,
            column: 'weight',
            message: 'Weight must be a positive number',
            value: row.weight
          });
        } else {
          row.weight = weight;
        }
      }

      // Validate dimensions
      if (row.dimensionsLength || row.dimensionsWidth || row.dimensionsHeight) {
        const length = parseFloat(row.dimensionsLength || '0');
        const width = parseFloat(row.dimensionsWidth || '0');
        const height = parseFloat(row.dimensionsHeight || '0');

        if (isNaN(length) || length < 0) {
          rowErrors.push({
            row: index + 2,
            column: 'dimensionsLength',
            message: 'Length must be a non-negative number',
            value: row.dimensionsLength
          });
        }
        if (isNaN(width) || width < 0) {
          rowErrors.push({
            row: index + 2,
            column: 'dimensionsWidth',
            message: 'Width must be a non-negative number',
            value: row.dimensionsWidth
          });
        }
        if (isNaN(height) || height < 0) {
          rowErrors.push({
            row: index + 2,
            column: 'dimensionsHeight',
            message: 'Height must be a non-negative number',
            value: row.dimensionsHeight
          });
        }

        // Add dimensions object if all are valid
        if (!isNaN(length) && !isNaN(width) && !isNaN(height)) {
          row.dimensions = {
            length,
            width,
            height
          };
        }
      }

      // Validate priority
      if (row.priority && !['low', 'normal', 'high', 'urgent'].includes(row.priority.toLowerCase())) {
        rowErrors.push({
          row: index + 2,
          column: 'priority',
          message: 'Priority must be one of: low, normal, high, urgent',
          value: row.priority
        });
      } else if (row.priority) {
        row.priority = row.priority.toLowerCase();
      }

      // Validate scheduled pickup date
      if (row.scheduledPickup) {
        const date = new Date(row.scheduledPickup);
        if (isNaN(date.getTime())) {
          rowErrors.push({
            row: index + 2,
            column: 'scheduledPickup',
            message: 'Invalid date format. Use YYYY-MM-DD HH:MM',
            value: row.scheduledPickup
          });
        } else {
          row.scheduledPickup = date;
        }
      }

      // If no errors, add to validated data
      if (rowErrors.length === 0) {
        // Remove dimension columns from row object
        delete row.dimensionsLength;
        delete row.dimensionsWidth;
        delete row.dimensionsHeight;
        
        validatedData.push(row);
      } else {
        errors.push(...rowErrors);
      }
    });

    return validatedData;
  }

  /**
   * Normalize headers based on mappings
   */
  private normalizeHeaders(
    rawHeaders: any[],
    columnMappings?: Record<string, string>
  ): string[] {
    return rawHeaders.map((header, index) => {
      if (!header) {
        return `column_${index + 1}`;
      }

      const headerStr = String(header).trim();
      
      // Apply column mappings
      if (columnMappings && columnMappings[headerStr]) {
        return columnMappings[headerStr];
      }

      // Convert to camelCase
      return this.toCamelCase(headerStr);
    });
  }

  /**
   * Clean cell value
   */
  private cleanCellValue(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

    // Trim strings
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }

    // Handle numbers
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }

    // Handle dates
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    return value;
  }

  /**
   * Convert string to camelCase
   */
  private toCamelCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, '');
  }
}

// Singleton instance
export const excelParser = new ExcelParser();