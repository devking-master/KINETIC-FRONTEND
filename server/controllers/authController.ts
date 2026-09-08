import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';

const generateToken = (user: { _id: unknown; email: string; username: string; role: string }): string => {
  const secret = process.env.JWT_SECRET || 'kinetic-super-secret-key-2026';
  return jwt.sign(
    { id: String(user._id), email: user.email, username: user.username, role: user.role },
    secret,
    { expiresIn: '7d' }
  );
};

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, username, email, password, role } = req.body;

    if (!name || !username || !email || !password) {
      res.status(400).json({ message: 'All required fields (name, username, email, password) must be provided' });
      return;
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      res.status(409).json({ message: 'User with this email or username already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      username,
      email,
      passwordHash,
      role: role || 'creator',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        role: user.role,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error during user registration', error: err instanceof Error ? err.message : err });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { loginIdentifier, password } = req.body;

    if (!loginIdentifier || !password) {
      res.status(400).json({ message: 'Email or username and password are required' });
      return;
    }

    const user = await User.findOne({
      $or: [{ email: loginIdentifier.toLowerCase() }, { username: loginIdentifier.toLowerCase() }]
    });

    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user);

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        role: user.role,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error during login', error: err instanceof Error ? err.message : err });
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving user profile', error: err instanceof Error ? err.message : err });
  }
};
