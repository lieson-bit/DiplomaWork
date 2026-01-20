"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const logger_1 = __importDefault(require("../utils/logger"));
class Database {
    constructor() {
        this.isConnected = false;
        this.pool = promise_1.default.createPool({
            host: process.env.MYSQL_HOST || 'customer-db',
            port: parseInt(process.env.MYSQL_PORT || '3306'),
            user: process.env.MYSQL_USER || 'customer_user',
            password: process.env.MYSQL_PASSWORD || 'customer_pass',
            database: process.env.MYSQL_DATABASE || 'customer_service_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });
        this.initialize();
    }
    static getInstance() {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }
    async initialize() {
        try {
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();
            this.isConnected = true;
            logger_1.default.info('Database connected successfully');
            const [rows] = await this.pool.query('SELECT 1 + 1 AS result');
            logger_1.default.info('Database test query successful:', rows);
        }
        catch (error) {
            logger_1.default.error('Database connection failed:', error);
            this.isConnected = false;
            setTimeout(() => this.initialize(), 5000);
        }
    }
    getConnection() {
        return this.pool;
    }
    async query(sql, params) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        }
        catch (error) {
            logger_1.default.error('Database query error:', error);
            throw error;
        }
    }
    async queryOne(sql, params) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            const results = rows;
            return results.length > 0 ? results[0] : null;
        }
        catch (error) {
            logger_1.default.error('Database query error:', error);
            throw error;
        }
    }
    async transaction(callback) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const result = await callback(connection);
            await connection.commit();
            return result;
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async checkHealth() {
        try {
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();
            return true;
        }
        catch (error) {
            return false;
        }
    }
}
exports.db = Database.getInstance();
exports.default = exports.db;
//# sourceMappingURL=database.js.map