declare class HttpClient {
    private static instance;
    private client;
    private constructor();
    static getInstance(): HttpClient;
    get(url: string, config?: any): Promise<import("axios").AxiosResponse<any, any, {}>>;
    post(url: string, data?: any, config?: any): Promise<import("axios").AxiosResponse<any, any, {}>>;
    put(url: string, data?: any, config?: any): Promise<import("axios").AxiosResponse<any, any, {}>>;
    patch(url: string, data?: any, config?: any): Promise<import("axios").AxiosResponse<any, any, {}>>;
    delete(url: string, config?: any): Promise<import("axios").AxiosResponse<any, any, {}>>;
}
export declare const httpClient: HttpClient;
export default httpClient;
//# sourceMappingURL=httpClient.d.ts.map