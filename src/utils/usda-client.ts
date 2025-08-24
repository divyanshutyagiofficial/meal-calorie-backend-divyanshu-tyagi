import axios from "axios";
import Fuse from "fuse.js";
import dotenv from "dotenv";
import { FoodItem } from "../types/usda";
dotenv.config();

const API_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const API_KEY = process.env.USDA_API_KEY!;
const PAGE_SIZE = Number(process.env.USDA_PAGE_SIZE) || 5;

export async function searchFood(query: string): Promise<FoodItem[]> {
    const res = await axios.get<{ foods: FoodItem[] }>(API_URL, {
        params: { api_key: API_KEY, query, pageSize: PAGE_SIZE },
    });
    return res.data.foods ?? [];
}

export function pickBestMatch(
    foods: FoodItem[],
    query: string
): FoodItem | null {
    const fuse = new Fuse(foods, { keys: ["description"], threshold: 0.4 });
    const result = fuse.search(query)[0];
    return result?.item ?? null;
}
