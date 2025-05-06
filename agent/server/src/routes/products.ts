import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from "../db"; 
// Create router instance for product endpoints
const productRoutes = new Hono();

// Schema for product creation/update
const productSchema = z.object({
  name: z.string().min(2),
  price: z.number().positive(),
  description: z.string().optional(),
  inStock: z.boolean().default(true)
});

// GET all products
productRoutes.get('/', async (c) => {
  // In a real app, this would fetch from a database
  return c.json({
    products: [
      { id: 1, name: 'Laptop', price: 999.99, inStock: true },
      { id: 2, name: 'Phone', price: 699.99, inStock: false }
    ]
  });
});



productRoutes.get('/testdb', async (c) => {
  console.log("Handling GET /api/base-environment");
	try {
		const query = db.query("SELECT key, value_json FROM son_base_environment;");
		const results = query.all() as { key: string; value_json: string }[];

		const baseEnvironment = results.reduce((acc, row) => {
			try {
				acc[row.key] = JSON.parse(row.value_json);
			} catch (parseError) {
				console.error(`Failed to parse JSON for base environment key "${row.key}":`, parseError);
				// Decide how to handle parse errors: skip the key, throw, return error response?
				// For now, we'll throw to indicate a server configuration issue.
				throw new Error(`Invalid JSON in database for key: ${row.key}`);
			}
			return acc;
		}, {} as Record<string, any>);

    return c.json(baseEnvironment, 200);
	} catch (error: any) {
		console.error("Error fetching base environment:", error);
		
	}
});

productRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  // In a real app, this would fetch from a database
  return c.json({
    product: { id: parseInt(id), name: 'Laptop', price: 999.99, inStock: true }
  });
});

// POST create a new product
productRoutes.post('/', zValidator('json', productSchema), async (c) => {
  const productData = c.req.valid('json');
  
  // In a real app, this would save to a database
  return c.json({
    message: 'Product created successfully',
    product: { id: 3, ...productData }
  }, 201);
});

// PUT update an existing product
productRoutes.put('/:id', zValidator('json', productSchema), async (c) => {
  const id = c.req.param('id');
  const productData = c.req.valid('json');
  
  // In a real app, this would update in a database
  return c.json({
    message: 'Product updated successfully',
    product: { id: parseInt(id), ...productData }
  });
});

// DELETE a product
productRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  
  // In a real app, this would delete from a database
  return c.json({
    message: `Product with ID ${id} deleted successfully`
  });
});

export { productRoutes };