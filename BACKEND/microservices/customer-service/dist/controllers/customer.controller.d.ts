import { Request, Response } from 'express';
export declare class CustomerController {
    private customerService;
    constructor();
    createProfile: (req: Request, res: Response) => Promise<Response>;
    getProfile: (req: Request, res: Response) => Promise<Response>;
    updateProfile: (req: Request, res: Response) => Promise<Response>;
    addAddress: (req: Request, res: Response) => Promise<Response>;
    updateAddress: (req: Request, res: Response) => Promise<Response>;
    deleteAddress: (req: Request, res: Response) => Promise<Response>;
    addPaymentMethod: (req: Request, res: Response) => Promise<Response>;
    updatePaymentMethod: (req: Request, res: Response) => Promise<Response>;
    deletePaymentMethod: (req: Request, res: Response) => Promise<Response>;
    updatePreferences: (req: Request, res: Response) => Promise<Response>;
    updateTimeSlots: (req: Request, res: Response) => Promise<Response>;
    addFeedback: (req: Request, res: Response) => Promise<Response>;
    updateOrderStats: (req: Request, res: Response) => Promise<Response>;
    getStats: (req: Request, res: Response) => Promise<Response>;
    uploadProfilePicture: (req: Request, res: Response) => Promise<Response>;
    deleteProfilePicture: (req: Request, res: Response) => Promise<Response>;
    searchCustomers: (req: Request, res: Response) => Promise<Response>;
}
//# sourceMappingURL=customer.controller.d.ts.map