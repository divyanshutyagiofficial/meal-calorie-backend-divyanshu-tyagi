export interface FoodItem {
    fdcId: number;
    description: string;
    foodNutrients: Nutrient[];
    servingSize?: number;
}

export interface Nutrient {
    nutrientNumber: string;
    value: number;
}
