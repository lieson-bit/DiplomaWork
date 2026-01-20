"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpClient = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("./logger"));
class HttpClient {
    constructor() {
        this.client = axios_1.default.create({
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'x-service-secret': process.env.SERVICE_SECRET
            }
        });
        this.client.interceptors.request.use((config) => {
            logger_1.default.debug(`HTTP Request: ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        }, (error) => {
            logger_1.default.error('HTTP Request Error:', error);
            return Promise.reject(error);
        });
        this.client.interceptors.response.use((response) => {
            logger_1.default.debug(`HTTP Response: ${response.status} ${response.config.url}`);
            return response;
        }, (error) => {
            if (error.response) {
                logger_1.default.error(`HTTP Error: ${error.response.status} - ${error.config.url}`);
            }
            else if (error.request) {
                logger_1.default.error('HTTP No Response:', error.request);
            }
            else {
                logger_1.default.error('HTTP Error:', error.message);
            }
            return Promise.reject(error);
        });
    }
    static getInstance() {
        if (!HttpClient.instance) {
            HttpClient.instance = new HttpClient();
        }
        return HttpClient.instance;
    }
    async get(url, config) {
        return this.client.get(url, config);
    }
    async post(url, data, config) {
        return this.client.post(url, data, config);
    }
    async put(url, data, config) {
        return this.client.put(url, data, config);
    }
    async patch(url, data, config) {
        return this.client.patch(url, data, config);
    }
    async delete(url, config) {
        return this.client.delete(url, config);
    }
}
exports.httpClient = HttpClient.getInstance();
exports.default = exports.httpClient;
//# sourceMappingURL=httpClient.js.map