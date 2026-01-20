import mysql from 'mysql2/promise';
declare class Database {
    private static instance;
    private pool;
    private isConnected;
    private constructor();
    static getInstance(): Database;
    private initialize;
    getConnection(): mysql.Pool;
    query<T = any>(sql: string, params?: any[]): Promise<T[]>;
    queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
    transaction<T = any>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T>;
    checkHealth(): Promise<boolean>;
}
export declare const db: Database;
export default db;
//# sourceMappingURL=database.d.ts.map