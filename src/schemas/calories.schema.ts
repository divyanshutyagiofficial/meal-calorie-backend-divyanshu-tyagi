import { z } from "zod";

export const getCaloriesSchema = z.object({
    dish_name: z
        .string()
        .min(1, "Dish name is required")
        .max(100, "Dish name must be less than 100 characters")
        .trim()
        .toLowerCase()
        .regex(
            /^[a-z0-9\s\-,']+$/,
            "Dish name can only contain letters, numbers, spaces, hyphens, commas and apostrophes"
        ),
    servings: z
        .number()
        .positive("Servings must be a positive number")
        .min(0.1, "Servings must be at least 0.1")
        .max(1000, "Servings must be less than 1000")
        .transform((val) => Math.round(val * 10) / 10),
});

export type GetCaloriesInput = z.infer<typeof getCaloriesSchema>;
