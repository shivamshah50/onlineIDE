const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Generic middleware factory: pass a zod schema, get an Express middleware back
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error.issues.map((issue) => issue.message).join(', '),
      });
    }

    req.body = result.data; // use the parsed, type-safe version
    return next();
  };
}

module.exports = { registerSchema, loginSchema, validate };