import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const router = Router();

export interface AuthenticatedRequest extends Request {
  user?: { id: string };
}


const protect = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]; 

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
    req.user = { id: decoded.id }; 
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid Token' });
  }
};


router.post('/', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, plateNumber, make, model, year } = req.body;
    const userId = req.user?.id; 

    if (!userId) {
      return res.status(401).json({ message: 'Details missing' });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        userId,
        name,
        plateNumber,
        make,
        model,
        year: Number(year),
      },
    });

    return res.status(201).json(vehicle);
  } catch (error) {
    return res.status(500).json({ message: 'Server error while creating vehicle', error });
  }
});

export default router;