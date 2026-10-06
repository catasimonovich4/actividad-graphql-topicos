import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import Product from '../models/Product.js';

function badInput(message) {
  return new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

function assertValidId(id) {
  if (!mongoose.isValidObjectId(id)) throw badInput(`ID inválido: ${id}`);
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildQuery(filter = {}) {
  const query = {};
  if (filter.name) query.name = { $regex: escapeRegex(filter.name), $options: 'i' };
  if (filter.category) query.category = { $regex: `^${escapeRegex(filter.category)}$`, $options: 'i' };

  if (filter.minPrice != null || filter.maxPrice != null) {
    query.price = {};
    if (filter.minPrice != null) query.price.$gte = filter.minPrice;
    if (filter.maxPrice != null) query.price.$lte = filter.maxPrice;
  }

  if (filter.minStock != null) query.stock = { $gte: filter.minStock };
  if (filter.inStock === true) query.stock = { ...query.stock, $gt: 0 };
  if (filter.inStock === false) query.stock = 0;

  return query;
}

// Mongoose lanza ValidationError ante datos inválidos (ej. precio negativo)
function toUserError(err) {
  return err instanceof mongoose.Error.ValidationError ? badInput(err.message) : err;
}

export const resolvers = {
  Query: {
    products: () => Product.find().sort({ name: 1 }).exec(),

    product: (_, { id }) => {
      assertValidId(id);
      return Product.findById(id).exec();
    },

    filterProducts: (_, { filter, sort, limit, offset }) => {
      let q = Product.find(buildQuery(filter ?? {}));
      if (sort) q = q.sort({ [sort.field]: sort.order === 'DESC' ? -1 : 1 });
      if (offset) q = q.skip(offset);
      if (limit) q = q.limit(limit);
      return q.exec();
    },

    categories: () => Product.distinct('category').exec(),
  },

  Mutation: {
    createProduct: async (_, { input }) => {
      try {
        return await Product.create(input);
      } catch (err) {
        throw toUserError(err);
      }
    },

    updateProduct: async (_, { id, input }) => {
      assertValidId(id);
      try {
        return await Product.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true });
      } catch (err) {
        throw toUserError(err);
      }
    },

    adjustStock: async (_, { id, amount }) => {
      assertValidId(id);
      // La condición en el filtro evita dejar el stock en negativo
      const updated = await Product.findOneAndUpdate(
        { _id: id, stock: { $gte: -amount } },
        { $inc: { stock: amount } },
        { new: true }
      );
      if (!updated && (await Product.exists({ _id: id }))) throw badInput('Stock insuficiente');
      return updated;
    },

    deleteProduct: async (_, { id }) => {
      assertValidId(id);
      const res = await Product.deleteOne({ _id: id });
      return res.deletedCount === 1;
    },
  },
};
