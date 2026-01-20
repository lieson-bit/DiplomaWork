import { Customer, CustomerAddress, CustomerPreference, CustomerPaymentMethod, CustomerFeedback, CreateCustomerDto, UpdateCustomerDto, AddressDto, PaymentMethodDto, PreferencesDto, TimeSlotDto, FeedbackDto, CustomerStats } from '../types';
export declare class CustomerService {
    private validateUser;
    createCustomer(userId: string, data: CreateCustomerDto): Promise<Customer>;
    getCustomerByUserId(userId: string): Promise<Customer | null>;
    getCustomerProfile(userId: string): Promise<any>;
    updateCustomer(userId: string, data: UpdateCustomerDto): Promise<Customer>;
    addAddress(userId: string, data: AddressDto): Promise<CustomerAddress>;
    updateAddress(userId: string, addressId: string, data: any): Promise<CustomerAddress>;
    deleteAddress(userId: string, addressId: string): Promise<void>;
    addPaymentMethod(userId: string, data: PaymentMethodDto): Promise<CustomerPaymentMethod>;
    updatePaymentMethod(userId: string, paymentMethodId: string, data: any): Promise<CustomerPaymentMethod>;
    deletePaymentMethod(userId: string, paymentMethodId: string): Promise<void>;
    updatePreferences(userId: string, data: PreferencesDto): Promise<CustomerPreference | null>;
    updateTimeSlots(userId: string, timeSlots: TimeSlotDto[]): Promise<void>;
    addFeedback(userId: string, data: FeedbackDto): Promise<CustomerFeedback>;
    private updateCustomerRating;
    updateOrderStats(userId: string, orderAmount: number): Promise<Customer>;
    getCustomerStats(userId: string): Promise<CustomerStats>;
    uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<string>;
    deleteProfilePicture(userId: string): Promise<void>;
    searchCustomers(searchTerm: string, filters?: {
        accountType?: string;
        status?: string;
        membershipLevel?: string;
        minOrders?: number;
        maxOrders?: number;
    }, page?: number, limit?: number): Promise<{
        customers: Customer[];
        total: number;
    }>;
}
//# sourceMappingURL=customer.service.d.ts.map