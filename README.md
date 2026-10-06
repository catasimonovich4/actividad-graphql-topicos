# API GraphQL de Productos

Express 5 + Apollo Server 5 + MongoDB Atlas (Mongoose). Introspección y Apollo Sandbox habilitados también en producción.

## Uso local

```bash
npm install
cp .env.example .env   # completar MONGODB_URI
npm run dev
```

Abrir http://localhost:4000/graphql → se carga Apollo Sandbox.

`npm run seed` carga productos de ejemplo solo si la colección está vacía (`npm run seed -- --force` la reemplaza).

## Despliegue en Render

1. Subir el repo a GitHub (`.env` está en `.gitignore`).
2. En Render: **New → Blueprint** y elegir el repo (usa `render.yaml`), o **New → Web Service** con
   build `npm install` y start `npm start`.
3. Cargar la variable `MONGODB_URI` en **Environment**.
4. En MongoDB Atlas → **Network Access**, permitir `0.0.0.0/0` (Render no tiene IP fija en el plan free).

La API queda en `https://<servicio>.onrender.com/graphql`.

## Ejemplos

```graphql
query {
  products { id name price stock category description }
}

query {
  filterProducts(
    filter: { category: "electronica", minPrice: 100, maxPrice: 900, inStock: true }
    sort: { field: price, order: DESC }
    limit: 5
  ) { id name price stock category }
}

query { categories }

mutation {
  updateProduct(id: "<ID>", input: { price: 199.99, stock: 20 }) {
    id name price stock
  }
}

mutation {
  adjustStock(id: "<ID>", amount: -2) { id stock }
}
```

### Operaciones

| Tipo | Nombre | Descripción |
|---|---|---|
| Query | `products` | Todos los productos |
| Query | `product(id)` | Un producto |
| Query | `filterProducts(filter, sort, limit, offset)` | Filtro por nombre (parcial), categoría (sin distinguir mayúsculas), rango de precio, stock mínimo y disponibilidad |
| Query | `categories` | Categorías distintas |
| Mutation | `createProduct(input)` | Crea un producto |
| Mutation | `updateProduct(id, input)` | Actualiza solo los campos enviados |
| Mutation | `adjustStock(id, amount)` | Suma/resta stock sin dejarlo negativo |
| Mutation | `deleteProduct(id)` | Elimina un producto |
