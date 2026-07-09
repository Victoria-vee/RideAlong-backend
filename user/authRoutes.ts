import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import{prisma} from './db';
import { BadRequestError} from './error';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

interface RegisterInput { email: string; password: string; }
interface LoginInput { email: string; password: string; }

router.post('/register', async (req: Request<{}, {}, RegisterInput>, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      throw new BadRequestError('Email credentials already exists');
    }
  
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({ data: { email, passwordHash } });

    res.status(201).json({ message: 'Account created successfully', userId: newUser.id });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req: Request<{}, {}, LoginInput>, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestError('Email invalid');

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) throw new BadRequestError('Password Invalid');

    const token = jwt.sign(
      { userId: user.id.toString(), email: user.email },
      JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.status(200).json({ token, message: "Login successful! Welcome to Stash!" });
  } catch (error) {
    next(error);
  }
});

export default router;