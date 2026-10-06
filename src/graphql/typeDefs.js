export const typeDefs = `#graphql
  type Product {
    id: ID!
    name: String!
    price: Float!
    stock: Int!
    category: String!
    description: String
  }

  "Filtros combinables (AND) para buscar productos"
  input ProductFilter {
    "Búsqueda parcial, sin distinguir mayúsculas"
    name: String
    "Coincidencia exacta, sin distinguir mayúsculas"
    category: String
    minPrice: Float
    maxPrice: Float
    minStock: Int
    "true = solo con stock > 0, false = solo sin stock"
    inStock: Boolean
  }

  enum SortField {
    name
    price
    stock
    category
  }

  enum SortOrder {
    ASC
    DESC
  }

  input ProductSort {
    field: SortField!
    order: SortOrder = ASC
  }

  input CreateProductInput {
    name: String!
    price: Float!
    stock: Int!
    category: String!
    description: String
  }

  "Todos los campos son opcionales: solo se actualizan los enviados"
  input UpdateProductInput {
    name: String
    price: Float
    stock: Int
    category: String
    description: String
  }

  type Query {
    "Todos los productos"
    products: [Product!]!
    "Un producto por id"
    product(id: ID!): Product
    "Productos filtrados, con orden y paginación opcionales"
    filterProducts(filter: ProductFilter, sort: ProductSort, limit: Int, offset: Int): [Product!]!
    "Categorías distintas existentes"
    categories: [String!]!
  }

  type Mutation {
    createProduct(input: CreateProductInput!): Product!
    "Actualiza solo los campos enviados en input"
    updateProduct(id: ID!, input: UpdateProductInput!): Product
    "Suma (o resta, con valor negativo) unidades al stock"
    adjustStock(id: ID!, amount: Int!): Product
    deleteProduct(id: ID!): Boolean!
  }
`;
