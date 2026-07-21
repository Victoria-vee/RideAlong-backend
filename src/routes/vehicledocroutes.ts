import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const prisma = new PrismaClient();
const router = Router();

export interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

const protect = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not authorized, token missing' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, invalid token' });
  }
};


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'vehicle-documents',
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
      resource_type: 'auto',
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    };
  },
});

const upload = multer({ storage: storage });

const getCloudinaryPublicId = (url: string) => {
  const parts = url.split('/');
  const filename = parts.pop();
  const folder = parts.pop();
  const publicIdWithExtension = `${folder}/${filename}`;
  return publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.'));
};

router.post('/', protect, upload.single('imageUrl'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: 'Request form data fields are missing.' });
    }

    const { vehicleId, documentType, issueDate, expirationDate } = req.body;
    const userId = req.user?.id;

    if (!req.file) {
      return res.status(400).json({ message: 'Document image file is required.' });
    }

    const imageUrl = req.file.path;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId as string },
    });

    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    if (vehicle.userId !== userId) return res.status(403).json({ message: 'Not authorized to modify this vehicle' });

    const document = await prisma.vehicleDocument.create({
      data: {
        userId,
        vehicleId: vehicleId as string,
        documentType,
        issueDate: new Date(issueDate),
        expirationDate: new Date(expirationDate),
        imageUrl: imageUrl,
      },
    });

    return res.status(201).json(document);
  } catch (error) {
    console.error('');
    console.error(error);
    return res.status(500).json({ message: 'Server error creating document.' });
  }
});

router.get('/vehicle/:vehicleId', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const vehicleId = req.params.vehicleId as string;
    const userId = req.user?.id;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    if (vehicle.userId !== userId) return res.status(403).json({ message: 'Not authorized' });

    const documents = await prisma.vehicleDocument.findMany({
      where: { vehicleId },
    });

    return res.status(200).json(documents);
  } catch (error) {
    console.error('Get Documents Error:', error);
    return res.status(500).json({ message: 'Server error fetching documents' });
  }
});

router.post('/', protect, upload.single('documentImage'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { vehicleId, documentType, issueDate, expirationDate } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || vehicle.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to add documents to this vehicle' });
    }

    const newDocument = await prisma.vehicleDocument.create({
      data: {
        vehicleId,
        userId,
        documentType,
        issueDate: new Date(issueDate),
        expirationDate: new Date(expirationDate),
        imageUrl: req.file.path,
      },
    });

    return res.status(201).json(newDocument);
  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ message: 'Server error uploading document' });
  }
});

router.patch('/:id', protect, upload.single('imageUrl'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.id;
    const { documentType, issueDate, expirationDate } = req.body;

    const existingDoc = await prisma.vehicleDocument.findUnique({
      where: { id },
      include: { vehicle: true },
    });

    if (!existingDoc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (existingDoc.vehicle.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to update this document' });
    }

    let imageUrl = existingDoc.imageUrl;

    if (req.file) {
      if (existingDoc.imageUrl) {
        try {
          const publicId = getCloudinaryPublicId(existingDoc.imageUrl);
          const isPdf = existingDoc.imageUrl.toLowerCase().endsWith('.pdf');

          await cloudinary.uploader.destroy(publicId, {
            resource_type: isPdf ? 'raw' : 'image',
            invalidate: true,
          });
        } catch (cloudErr) {
          console.warn('Could not delete old Cloudinary asset:', cloudErr);
        }
      }

      imageUrl = req.file.path;
    }

    const updatedDocument = await prisma.vehicleDocument.update({
      where: { id },
      data: {
        documentType: documentType !== undefined ? documentType : existingDoc.documentType,
        issueDate: issueDate !== undefined ? new Date(issueDate) : existingDoc.issueDate,
        expirationDate: expirationDate ? new Date(expirationDate) : existingDoc.expirationDate,
        imageUrl,
      },
    });

    return res.status(200).json(updatedDocument);
  } catch (error) {
    console.error('Update Document Error:', error);
    return res.status(500).json({ message: 'Server error updating document' });
  }
});

export default router;