import { v4 as uuidv4 } from 'uuid';
import { connectDB, disconnectDB, query, initializeDatabase, pool } from '../lib/mysql';

// Helper function to normalize user data from database
function normalizeUser(user: any): any {
  if (!user) return null;
  
  return {
    id: user.id,
    email: user.email,
    password: user.password,
    firstName: user.first_name,
    lastName: user.last_name,
    phone: user.phone,
    userType: user.user_type,
    emailVerified: Boolean(user.email_verified),
    phoneVerified: Boolean(user.phone_verified),
    isActive: Boolean(user.is_active),
    profileCompleted: Boolean(user.profile_completed),
    lastLogin: user.last_login,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

// Helper functions for user operations
const userModel = {
  findUnique: async ({ where }: any) => {
    let condition = '';
    const values: any[] = [];
    
    if (where.id) {
      condition = 'id = ?';
      values.push(where.id);
    } else if (where.email) {
      condition = 'email = ?';
      values.push(where.email);
    }
    
    if (!condition) return null;
    
    const rows = await query(
      `SELECT * FROM users WHERE ${condition} LIMIT 1`,
      values
    );
    const user = (rows as any[])[0] || null;
    return normalizeUser(user);
  },
  
  findMany: async (options?: any) => {
    let sql = 'SELECT * FROM users';
    const values: any[] = [];
    
    if (options?.where) {
      const conditions = [];
      if (options.where.userType) {
        conditions.push('user_type = ?');
        values.push(options.where.userType);
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
    }
    
    // Handle orderBy - convert camelCase to snake_case
    if (options?.orderBy) {
      const orderBy = options.orderBy;
      const field = Object.keys(orderBy)[0];
      const direction = orderBy[field];
      
      // Map camelCase to snake_case
      const fieldMap: Record<string, string> = {
        'createdAt': 'created_at',
        'updatedAt': 'updated_at',
        'firstName': 'first_name',
        'lastName': 'last_name',
        'userType': 'user_type',
        'emailVerified': 'email_verified',
        'phoneVerified': 'phone_verified',
        'isActive': 'is_active',
        'profileCompleted': 'profile_completed',
        'lastLogin': 'last_login'
      };
      
      const dbField = fieldMap[field] || field;
      sql += ` ORDER BY ${dbField} ${direction}`;
    } else {
      sql += ' ORDER BY created_at DESC';
    }
    
    const rows = await query(sql, values);
    return (rows as any[]).map(normalizeUser);
  },
  
  create: async ({ data }: any) => {
    const id = uuidv4();
    const now = new Date();
    
    await query(
      `INSERT INTO users (
        id, email, password, first_name, last_name, phone, user_type,
        email_verified, phone_verified, is_active, profile_completed,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.email,
        data.password,
        data.firstName,
        data.lastName,
        data.phone || null,
        data.userType,
        data.emailVerified ? 1 : 0,
        data.phoneVerified ? 1 : 0,
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
        data.profileCompleted ? 1 : 0,
        now,
        now
      ]
    );
    
    return await userModel.findUnique({ where: { id } });
  },
  
  update: async ({ where, data }: any) => {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email);
    }
    if (data.firstName !== undefined) {
      updates.push('first_name = ?');
      values.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(data.lastName);
    }
    if (data.phone !== undefined) {
      updates.push('phone = ?');
      values.push(data.phone);
    }
    if (data.userType !== undefined) {
      updates.push('user_type = ?');
      values.push(data.userType);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }
    if (data.profileCompleted !== undefined) {
      updates.push('profile_completed = ?');
      values.push(data.profileCompleted ? 1 : 0);
    }
    if (data.lastLogin !== undefined) {
      updates.push('last_login = ?');
      values.push(data.lastLogin);
    }
    
    // Always update updated_at
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    values.push(where.id || where.email);
    const condition = where.id ? 'id = ?' : 'email = ?';
    
    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE ${condition}`,
      values
    );
    
    return await userModel.findUnique({ where });
  },
  
  count: async (options?: any) => {
    let sql = 'SELECT COUNT(*) as count FROM users';
    const values: any[] = [];
    
    if (options?.where) {
      const conditions = [];
      if (options.where.userType) {
        conditions.push('user_type = ?');
        values.push(options.where.userType);
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
    }
    
    const rows = await query(sql, values);
    return (rows as any[])[0].count;
  },
};

// Helper functions for userSession operations
const userSessionModel = {
  create: async ({ data }: any) => {
    const id = uuidv4();
    
    await query(
      `INSERT INTO user_sessions (
        id, user_id, token, refresh_token, device_info, ip_address, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.userId,
        data.token,
        data.refreshToken,
        data.deviceInfo || null,
        data.ipAddress || null,
        data.expiresAt
      ]
    );
    
    const rows = await query(
      'SELECT * FROM user_sessions WHERE id = ?',
      [id]
    );
    return (rows as any[])[0];
  },
  
  findFirst: async ({ where }: any) => {
    let condition = '';
    const values: any[] = [];
    
    if (where.refreshToken) {
      condition = 'refresh_token = ? AND expires_at > NOW()';
      values.push(where.refreshToken);
    } else if (where.token) {
      condition = 'token = ?';
      values.push(where.token);
    }
    
    if (!condition) return null;
    
    const rows = await query(
      `SELECT us.*, u.user_type 
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       WHERE ${condition} LIMIT 1`,
      values
    );
    return (rows as any[])[0] || null;
  },
  
  update: async ({ where, data }: any) => {
    await query(
      'UPDATE user_sessions SET token = ? WHERE id = ?',
      [data.token, where.id]
    );
    
    const rows = await query(
      'SELECT * FROM user_sessions WHERE id = ?',
      [where.id]
    );
    return (rows as any[])[0];
  },
  
  deleteMany: async ({ where }: any) => {
    if (where.token) {
      const result = await query(
        'DELETE FROM user_sessions WHERE token = ?',
        [where.token]
      );
      return { count: (result as any).affectedRows };
    }
    return { count: 0 };
  },
};

// Create a mock Prisma-like interface for compatibility
export const prisma = {
  $connect: async () => {
    await connectDB();
    await initializeDatabase();
  },
  $disconnect: disconnectDB,
  $queryRaw: async (sql: TemplateStringsArray, ...params: any[]) => {
    return query(sql.join('?'), params);
  },
  user: userModel,
  userSession: userSessionModel,
  $transaction: async (operations: any[]) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const results = [];
      
      for (const operation of operations) {
        results.push(await operation());
      }
      
      await connection.commit();
      return results;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ MySQL database connected and initialized');
  } catch (error: any) {
    console.error('❌ Failed to connect to MySQL database:', error.message);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}