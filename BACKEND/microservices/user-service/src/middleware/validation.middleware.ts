import { Request, Response, NextFunction } from 'express';
import { ValidationUtils } from '../utils/validation';

export const validateRegister = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const validation = ValidationUtils.validateRegister(req.body);
  
  if (!validation.isValid) {
    res.status(400).json({ 
      error: 'Validation failed',
      details: validation.errors 
    });
    return;
  }
  
  next();
};

export const validateLogin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const validation = ValidationUtils.validateLogin(req.body);
  
  if (!validation.isValid) {
    res.status(400).json({ 
      error: 'Validation failed',
      details: validation.errors 
    });
    return;
  }
  
  next();
};

export const validateUserId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { userId } = req.params;
  
  if (!userId || userId.trim().length === 0) {
    res.status(400).json({ error: 'User ID is required' });
    return;
  }
  
  next();
};