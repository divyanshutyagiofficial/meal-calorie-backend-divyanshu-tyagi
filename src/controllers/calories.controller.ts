import { Request, Response, NextFunction } from "express";
import { searchFood, pickBestMatch } from "../utils/usda-client";
import { getCaloriesSchema } from "../schemas/calories.schema";
import { ZodError } from "zod";

export const getCalories = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const validatedData = getCaloriesSchema.parse(req.body);
        const { dish_name: rawName, servings } = validatedData;

        const dish_name = sanitizeDishName(rawName);
        if (!dish_name) {
            return res
                .status(400)
                .json({ error: "Invalid dish name after sanitization" });
        }

        const foods = await searchFood(dish_name);

        if (!foods.length)
            return res.status(404).json({ error: "Dish not found" });

        const best = pickBestMatch(foods, dish_name);
        if (!best)
            return res
                .status(404)
                .json({ error: "No nutrition data available" });

        const calNutrient = best.foodNutrients.find(
            (n) => n.nutrientNumber === "208"
        )?.value;

        if (!calNutrient)
            return res.status(404).json({ error: "Calories data missing" });

        // Extract macronutrients (per 100g from USDA)
        const proteinNutrient = best.foodNutrients.find(
            (n) => n.nutrientNumber === "203"
        )?.value || 0; // Protein
        
        const fatNutrient = best.foodNutrients.find(
            (n) => n.nutrientNumber === "204"
        )?.value || 0; // Total lipid (fat)
        
        const carbNutrient = best.foodNutrients.find(
            (n) => n.nutrientNumber === "205"
        )?.value || 0; // Carbohydrate, by difference

        const fiberNutrient = best.foodNutrients.find(
            (n) => n.nutrientNumber === "291"
        )?.value || 0; // Fiber, total dietary

        const servingGram = best.servingSize ?? 100;
        const caloriesPerServing = (calNutrient / 100) * servingGram;
        const totalCalories = caloriesPerServing * servings;

        // Calculate macronutrients per serving
        const proteinPerServing = (proteinNutrient / 100) * servingGram;
        const fatPerServing = (fatNutrient / 100) * servingGram;
        const carbPerServing = (carbNutrient / 100) * servingGram;
        const fiberPerServing = (fiberNutrient / 100) * servingGram;

        res.json({
            dish_name: best.description,
            servings,
            serving_size_g: servingGram,
            calories_per_serving: Math.round(caloriesPerServing),
            total_calories: Math.round(totalCalories),
            macronutrients: {
                per_serving: {
                    protein_g: Math.round(proteinPerServing * 10) / 10,
                    fat_g: Math.round(fatPerServing * 10) / 10,
                    carbohydrates_g: Math.round(carbPerServing * 10) / 10,
                    fiber_g: Math.round(fiberPerServing * 10) / 10,
                },
                total: {
                    protein_g: Math.round(proteinPerServing * servings * 10) / 10,
                    fat_g: Math.round(fatPerServing * servings * 10) / 10,
                    carbohydrates_g: Math.round(carbPerServing * servings * 10) / 10,
                    fiber_g: Math.round(fiberPerServing * servings * 10) / 10,
                }
            },
            source: "USDA FoodData Central",
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: "Validation failed",
                details: error.errors,
            });
        }
        next(error);
    }
};

function sanitizeDishName(raw: string): string {
    return raw.replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
}
