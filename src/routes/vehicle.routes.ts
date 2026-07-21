import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { v2 as cloudinary } from 'cloudinary';

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

const getCloudinaryPublicId = (url: string) => {
  const parts = url.split('/');
  const filename = parts.pop();
  const folder = parts.pop();
  const publicIdWithExtension = `${folder}/${filename}`;
  return publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.'));
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

router.get('/', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const vehicles = await prisma.vehicle.findMany({
      where: { userId },
      include: {
        vehicleDocuments: true, 
      }
    });


    return res.status(200).json(vehicles);
  } catch (error) {
    console.error('Get Vehicles Error:', error);
    return res.status(500).json({ message: 'Server error fetching vehicles' });
  }
});

router.get('/:id', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.id;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        vehicleDocuments: true,
      },
    });

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (vehicle.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to view this vehicle' });
    }

    return res.status(200).json(vehicle);
  } catch (error) {
    console.error('Get Single Vehicle Error:', error);
    return res.status(500).json({ message: 'Server error fetching vehicle' });
  }
});

router.patch('/:id', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.id;

    const existingVehicle = await prisma.vehicle.findUnique({ where: { id } });

    if (!existingVehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (existingVehicle.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to update this vehicle' });
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        ...req.body,
      },
      include: {
        vehicleDocuments: true,
      },
    });

    return res.status(200).json(updatedVehicle);
  } catch (error) {
    console.error('Update Vehicle Error:', error);
    return res.status(500).json({ message: 'Server error updating vehicle' });
  }
});


router.delete('/:id', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.id;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { vehicleDocuments: true },
    });

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (vehicle.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this vehicle' });
    }

    for (const doc of vehicle.vehicleDocuments) {
      if (doc.imageUrl) {
        try {
          const publicId = getCloudinaryPublicId(doc.imageUrl);
          const isPdf = doc.imageUrl.toLowerCase().endsWith('.pdf');
          await cloudinary.uploader.destroy(publicId, {
            resource_type: isPdf ? 'raw' : 'image',
          });
        } catch (cloudErr) {
          console.warn(`Failed to delete Cloudinary asset for doc ${doc.id}:`, cloudErr);
        }
      }
    }

    await prisma.vehicle.delete({
      where: { id },
    });

    return res.status(200).json({ message: 'Vehicle and associated documents deleted successfully' });
  } catch (error) {
    console.error('Delete Vehicle Error:', error);
    return res.status(500).json({ message: 'Server error deleting vehicle' });
  }
});
export default router;