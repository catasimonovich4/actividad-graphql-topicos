import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './db.js';
import Product from './models/Product.js';

const products = [
  { name: 'Notebook Lenovo IdeaPad 3', price: 850000, stock: 12, category: 'Electrónica', description: 'Ryzen 5, 16GB RAM, 512GB SSD' },
  { name: 'Mouse Logitech M170', price: 18000, stock: 60, category: 'Electrónica', description: 'Mouse inalámbrico' },
  { name: 'Auriculares Sony WH-CH520', price: 95000, stock: 0, category: 'Electrónica', description: 'Bluetooth, 50 h de batería' },
  { name: 'Silla de oficina ergonómica', price: 240000, stock: 5, category: 'Muebles', description: 'Respaldo de malla y apoyo lumbar' },
  { name: 'Escritorio de pino', price: 160000, stock: 3, category: 'Muebles', description: '120 x 60 cm' },
  { name: 'Yerba mate 1kg', price: 4500, stock: 200, category: 'Alimentos', description: 'Con palo, molienda tradicional' },
  { name: 'Café en grano 500g', price: 12000, stock: 40, category: 'Alimentos', description: 'Tostado medio' },
  { name: 'Clean Code', price: 38000, stock: 8, category: 'Libros', description: 'Robert C. Martin' },
];

await connectDB();

// Protege datos existentes: solo reemplaza si se ejecuta con --force
const existing = await Product.countDocuments();
if (existing > 0 && !process.argv.includes('--force')) {
  console.log(`La colección ya tiene ${existing} productos. Usá "npm run seed -- --force" para reemplazarlos.`);
  await mongoose.disconnect();
  process.exit(0);
}

await Product.deleteMany({});
await Product.insertMany(products);
console.log(`Insertados ${products.length} productos`);
await mongoose.disconnect();
