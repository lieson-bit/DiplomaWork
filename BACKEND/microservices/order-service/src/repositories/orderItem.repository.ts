import { db } from '../config/database';
import { logger } from '../utils/logger';

export interface OrderItem {
  id: string;
  order_id: string;
  item_name: string;
  item_description: string | null;
  quantity: number;
  weight_per_item_kg: number | null;
  dimensions_length_cm: number | null;
  dimensions_width_cm: number | null;
  dimensions_height_cm: number | null;
  value_per_item: number | null;
  fragile: boolean;
  liquid: boolean;
  temperature_sensitive: boolean;
  special_handling: string | null;
  barcode: string | null;
  sku: string | null;
  created_at: Date;
}

export interface CreateOrderItemData {
  order_id: string;
  item_name: string;
  item_description?: string;
  quantity?: number;
  weight_per_item_kg?: number;
  dimensions_length_cm?: number;
  dimensions_width_cm?: number;
  dimensions_height_cm?: number;
  value_per_item?: number;
  fragile?: boolean;
  liquid?: boolean;
  temperature_sensitive?: boolean;
  special_handling?: string;
  barcode?: string;
  sku?: string;
}

export class OrderItemRepository {
  async create(data: CreateOrderItemData): Promise<OrderItem> {
    try {
      const sql = `
        INSERT INTO order_items (
          order_id, item_name, item_description, quantity,
          weight_per_item_kg, dimensions_length_cm, dimensions_width_cm, dimensions_height_cm,
          value_per_item, fragile, liquid, temperature_sensitive,
          special_handling, barcode, sku
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        data.order_id,
        data.item_name,
        data.item_description || null,
        data.quantity || 1,
        data.weight_per_item_kg || null,
        data.dimensions_length_cm || null,
        data.dimensions_width_cm || null,
        data.dimensions_height_cm || null,
        data.value_per_item || null,
        data.fragile || false,
        data.liquid || false,
        data.temperature_sensitive || false,
        data.special_handling || null,
        data.barcode || null,
        data.sku || null
      ];
      
      const result = await db.execute(sql, params);
      return await this.findById(result.insertId.toString()) as OrderItem;
      
    } catch (error: any) {
      logger.error('Failed to create order item:', error);
      throw new Error(`Order item creation failed: ${error.message}`);
    }
  }

  async createBatch(items: CreateOrderItemData[]): Promise<OrderItem[]> {
    try {
      if (items.length === 0) return [];
      
      // Use transaction for batch insert
      return await db.transaction(async (connection) => {
        const createdItems: OrderItem[] = [];
        
        for (const itemData of items) {
          const sql = `
            INSERT INTO order_items (
              order_id, item_name, item_description, quantity,
              weight_per_item_kg, dimensions_length_cm, dimensions_width_cm, dimensions_height_cm,
              value_per_item, fragile, liquid, temperature_sensitive,
              special_handling, barcode, sku
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          
          const params = [
            itemData.order_id,
            itemData.item_name,
            itemData.item_description || null,
            itemData.quantity || 1,
            itemData.weight_per_item_kg || null,
            itemData.dimensions_length_cm || null,
            itemData.dimensions_width_cm || null,
            itemData.dimensions_height_cm || null,
            itemData.value_per_item || null,
            itemData.fragile || false,
            itemData.liquid || false,
            itemData.temperature_sensitive || false,
            itemData.special_handling || null,
            itemData.barcode || null,
            itemData.sku || null
          ];
          
          const [result] = await connection.execute(sql, params);
          const itemId = (result as any).insertId;
          
          // Fetch the created item
          const [items] = await connection.query<OrderItem[]>(
            'SELECT * FROM order_items WHERE id = ?',
            [itemId]
          );
          
          if (items.length > 0) {
            createdItems.push(items[0]);
          }
        }
        
        return createdItems;
      });
      
    } catch (error: any) {
      logger.error('Failed to create order items batch:', error);
      throw new Error(`Batch order item creation failed: ${error.message}`);
    }
  }

  async findById(id: string): Promise<OrderItem | null> {
    try {
      const sql = 'SELECT * FROM order_items WHERE id = ? LIMIT 1';
      const items = await db.query<OrderItem>(sql, [id]);
      return items.length > 0 ? items[0] : null;
    } catch (error: any) {
      logger.error('Failed to find order item by ID:', error);
      throw error;
    }
  }

  async findByOrderId(orderId: string): Promise<OrderItem[]> {
    try {
      const sql = 'SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at';
      return await db.query<OrderItem>(sql, [orderId]);
    } catch (error: any) {
      logger.error('Failed to find order items by order ID:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<CreateOrderItemData>): Promise<OrderItem | null> {
    try {
      const updates: string[] = [];
      const params: any[] = [];
      
      // Build dynamic update query
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          updates.push(`${key} = ?`);
          params.push(value);
        }
      });
      
      if (updates.length === 0) {
        return await this.findById(id);
      }
      
      params.push(id);
      
      const sql = `UPDATE order_items SET ${updates.join(', ')} WHERE id = ?`;
      await db.execute(sql, params);
      
      return await this.findById(id);
    } catch (error: any) {
      logger.error('Failed to update order item:', error);
      throw new Error(`Order item update failed: ${error.message}`);
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const sql = 'DELETE FROM order_items WHERE id = ?';
      const result = await db.execute(sql, [id]);
      return result.affectedRows > 0;
    } catch (error: any) {
      logger.error('Failed to delete order item:', error);
      throw error;
    }
  }

  async deleteByOrderId(orderId: string): Promise<boolean> {
    try {
      const sql = 'DELETE FROM order_items WHERE order_id = ?';
      const result = await db.execute(sql, [orderId]);
      return result.affectedRows > 0;
    } catch (error: any) {
      logger.error('Failed to delete order items by order ID:', error);
      throw error;
    }
  }

  async calculateOrderTotals(orderId: string): Promise<{
    totalWeight: number;
    totalVolume: number;
    totalValue: number;
    itemCount: number;
    fragileCount: number;
    temperatureSensitiveCount: number;
  }> {
    try {
      const sql = `
        SELECT 
          COALESCE(SUM(weight_per_item_kg * quantity), 0) as total_weight,
          COALESCE(SUM(
            (dimensions_length_cm * dimensions_width_cm * dimensions_height_cm) / 1000000 * quantity
          ), 0) as total_volume,
          COALESCE(SUM(value_per_item * quantity), 0) as total_value,
          COUNT(*) as item_count,
          SUM(CASE WHEN fragile = TRUE THEN 1 ELSE 0 END) as fragile_count,
          SUM(CASE WHEN temperature_sensitive = TRUE THEN 1 ELSE 0 END) as temperature_sensitive_count
        FROM order_items 
        WHERE order_id = ?
      `;
      
      const result = await db.queryOne<{
        total_weight: number;
        total_volume: number;
        total_value: number;
        item_count: number;
        fragile_count: number;
        temperature_sensitive_count: number;
      }>(sql, [orderId]);
      
      return {
        totalWeight: parseFloat(result?.total_weight?.toString() || '0'),
        totalVolume: parseFloat(result?.total_volume?.toString() || '0'),
        totalValue: parseFloat(result?.total_value?.toString() || '0'),
        itemCount: result?.item_count || 0,
        fragileCount: result?.fragile_count || 0,
        temperatureSensitiveCount: result?.temperature_sensitive_count || 0
      };
    } catch (error: any) {
      logger.error('Failed to calculate order totals:', error);
      throw error;
    }
  }

  async getItemsForPacking(orderId: string): Promise<Array<{
    id: string;
    name: string;
    weight: number;
    volume: number;
    fragile: boolean;
    temperatureSensitive: boolean;
    dimensions?: {
      length: number;
      width: number;
      height: number;
    };
  }>> {
    try {
      const sql = `
        SELECT 
          id,
          item_name as name,
          COALESCE(weight_per_item_kg, 0.1) as weight,
          COALESCE(
            (dimensions_length_cm * dimensions_width_cm * dimensions_height_cm) / 1000000,
            0.01
          ) as volume,
          fragile,
          temperature_sensitive as temperatureSensitive,
          dimensions_length_cm as length,
          dimensions_width_cm as width,
          dimensions_height_cm as height
        FROM order_items 
        WHERE order_id = ?
        ORDER BY weight DESC, volume DESC
      `;
      
      const items = await db.query<any>(sql, [orderId]);
      
      return items.map(item => ({
        id: item.id,
        name: item.name,
        weight: parseFloat(item.weight),
        volume: parseFloat(item.volume),
        fragile: Boolean(item.fragile),
        temperatureSensitive: Boolean(item.temperatureSensitive),
        dimensions: item.length && item.width && item.height ? {
          length: parseFloat(item.length),
          width: parseFloat(item.width),
          height: parseFloat(item.height)
        } : undefined
      }));
    } catch (error: any) {
      logger.error('Failed to get items for packing:', error);
      throw error;
    }
  }

  async validateItemsCapacity(orderId: string, maxWeight: number, maxVolume: number): Promise<{
    canFit: boolean;
    totalWeight: number;
    totalVolume: number;
    weightUtilization: number;
    volumeUtilization: number;
    overweightItems: Array<{ id: string; name: string; weight: number }>;
    oversizedItems: Array<{ id: string; name: string; volume: number }>;
  }> {
    try {
      const totals = await this.calculateOrderTotals(orderId);
      const items = await this.getItemsForPacking(orderId);
      
      const overweightItems = items
        .filter(item => item.weight > maxWeight)
        .map(item => ({
          id: item.id,
          name: item.name,
          weight: item.weight
        }));
      
      const oversizedItems = items
        .filter(item => item.volume > maxVolume)
        .map(item => ({
          id: item.id,
          name: item.name,
          volume: item.volume
        }));
      
      const canFit = 
        totals.totalWeight <= maxWeight && 
        totals.totalVolume <= maxVolume &&
        overweightItems.length === 0 &&
        oversizedItems.length === 0;
      
      return {
        canFit,
        totalWeight: totals.totalWeight,
        totalVolume: totals.totalVolume,
        weightUtilization: (totals.totalWeight / maxWeight) * 100,
        volumeUtilization: (totals.totalVolume / maxVolume) * 100,
        overweightItems,
        oversizedItems
      };
    } catch (error: any) {
      logger.error('Failed to validate items capacity:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const orderItemRepository = new OrderItemRepository();

// Export for direct use
export default orderItemRepository;