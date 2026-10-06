import dns from 'node:dns';
import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Falta la variable de entorno MONGODB_URI');

  // Opcional: en algunas redes Windows Node no resuelve registros SRV (querySrv ECONNREFUSED).
  // Ej.: DNS_SERVERS="8.8.8.8,1.1.1.1". En Render no hace falta.
  if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'Productos' });
  console.log(`MongoDB conectado (base: ${mongoose.connection.name})`);
}
