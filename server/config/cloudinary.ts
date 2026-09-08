import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const cloudName = requiredEnv('CLOUDINARY_CLOUD_NAME');
const apiKey = requiredEnv('CLOUDINARY_API_KEY');
const apiSecret = requiredEnv('CLOUDINARY_API_SECRET');

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

export { apiKey, apiSecret, cloudName };
export default cloudinary;
