import supertest from "supertest";
import app from "../src/app";
import dotenv from "dotenv";
import { userRepository } from "../src/repositories/user.repository";
import jwt from "jsonwebtoken";

// Mock mongoose and userRepository
jest.mock("mongoose", () => ({
    connect: jest.fn().mockResolvedValue(undefined),
    connection: {
        dropDatabase: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        collection: jest.fn().mockReturnValue({
            deleteMany: jest.fn().mockResolvedValue(undefined),
        }),
    },
}));

jest.mock("../src/repositories/user.repository", () => ({
    userRepository: {
        findByEmail: jest.fn(),
    },
}));

// Mock jwt
jest.mock("jsonwebtoken", () => ({
    sign: jest.fn().mockReturnValue("mock-token"),
    verify: jest.fn().mockImplementation((token) => {
        if (token === "mock-token") {
            return { userId: "mockUserId" };
        }
        throw new Error("Invalid token");
    }),
}));

// Mock USDA client
jest.mock("../src/utils/usda-client", () => ({
    searchFood: jest.fn().mockResolvedValue([
        {
            description: "apple",
            foodNutrients: [
                { nutrientNumber: "208", value: 52 }, // Calories
                { nutrientNumber: "203", value: 0.3 }, // Protein
                { nutrientNumber: "204", value: 0.2 }, // Fat
                { nutrientNumber: "205", value: 14 }, // Carbs
                { nutrientNumber: "291", value: 2.4 }, // Fiber
            ],
            servingSize: 100,
        },
    ]),
    pickBestMatch: jest.fn().mockImplementation((foods) => foods[0]),
}));

dotenv.config();

const request = supertest(app);

describe("Calories Endpoints", () => {
    const testUser = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        password: "password123",
    };

    const mockUser = {
        ...testUser,
        _id: "mockUserId",
        password: "hashedPassword",
    };

    const mockToken = "mock-token";

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        // Mock user lookup for token verification
        (userRepository.findByEmail as jest.Mock).mockResolvedValue(mockUser);
    });

    describe("POST /get-calories", () => {
        it("should get calories for a valid dish", async () => {
            const res = await request
                .post("/get-calories")
                .set("Authorization", `Bearer ${mockToken}`)
                .send({ dish_name: "apple", servings: 2 });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("dish_name", "apple");
            expect(res.body).toHaveProperty("servings", 2);
            expect(res.body).toHaveProperty("calories_per_serving");
            expect(res.body).toHaveProperty("total_calories");
            expect(res.body).toHaveProperty("macronutrients");
            expect(res.body.macronutrients).toHaveProperty("per_serving");
            expect(res.body.macronutrients).toHaveProperty("total");
            expect(res.body).toHaveProperty("source", "USDA FoodData Central");
            expect(jwt.verify).toHaveBeenCalledWith(
                mockToken,
                expect.any(String)
            );
        });

        it("should reject request without authentication", async () => {
            const res = await request
                .post("/get-calories")
                .send({ dish_name: "apple", servings: 2 });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty("error", "No token");
            expect(jwt.verify).not.toHaveBeenCalled();
        });

        it("should reject request with invalid token", async () => {
            const res = await request
                .post("/get-calories")
                .set("Authorization", "Bearer invalid-token")
                .send({ dish_name: "apple", servings: 2 });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty("error", "Invalid token");
            expect(jwt.verify).toHaveBeenCalledWith(
                "invalid-token",
                expect.any(String)
            );
        });

        it("should reject request with zero servings", async () => {
            const res = await request
                .post("/get-calories")
                .set("Authorization", `Bearer ${mockToken}`)
                .send({ dish_name: "apple", servings: 0 });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error", "Validation failed");
            expect(jwt.verify).toHaveBeenCalled();
        });

        it("should reject request with negative servings", async () => {
            const res = await request
                .post("/get-calories")
                .set("Authorization", `Bearer ${mockToken}`)
                .send({ dish_name: "apple", servings: -1 });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error", "Validation failed");
            expect(jwt.verify).toHaveBeenCalled();
        });

        it("should handle non-existent dish", async () => {
            // Mock no results from USDA client
            const { searchFood } = require("../src/utils/usda-client");
            (searchFood as jest.Mock).mockResolvedValueOnce([]);

            const res = await request
                .post("/get-calories")
                .set("Authorization", `Bearer ${mockToken}`)
                .send({ dish_name: "nonexistentdish123", servings: 1 });

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty("error", "Dish not found");
            expect(jwt.verify).toHaveBeenCalled();
        });

        it("should reject request with empty dish name", async () => {
            const res = await request
                .post("/get-calories")
                .set("Authorization", `Bearer ${mockToken}`)
                .send({ dish_name: "", servings: 1 });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error", "Validation failed");
            expect(jwt.verify).toHaveBeenCalled();
        });

        it("should reject request with too long dish name", async () => {
            const res = await request
                .post("/get-calories")
                .set("Authorization", `Bearer ${mockToken}`)
                .send({ dish_name: "a".repeat(101), servings: 1 });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error", "Validation failed");
            expect(jwt.verify).toHaveBeenCalled();
        });

        // Test for zero servings
        it("should reject request with zero servings", async () => {
            const res = await request
                .post("/get-calories")
                .set("Authorization", `Bearer ${mockToken}`)
                .send({ dish_name: "apple", servings: 0 });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error", "Validation failed");
            expect(res.body.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        message: "Servings must be a positive number"
                    })
                ])
            );
        });

        // Test for negative servings
        it("should reject request with negative servings", async () => {
            const res = await request
                .post("/get-calories")
                .set("Authorization", `Bearer ${mockToken}`)
                .send({ dish_name: "apple", servings: -1 });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error", "Validation failed");
            expect(res.body.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        message: "Servings must be a positive number"
                    })
                ])
            );
        });

        // Test common dishes
        describe("Common Dishes Tests", () => {
            beforeEach(() => {
                jest.clearAllMocks();
            });

            it("should get calories for macaroni and cheese", async () => {
                const { searchFood, pickBestMatch } = require("../src/utils/usda-client");
                
                // Mock USDA response for macaroni and cheese
                (searchFood as jest.Mock).mockResolvedValueOnce([
                    {
                        description: "Macaroni and cheese, box mix, prepared",
                        foodNutrients: [
                            { nutrientNumber: "208", value: 164 }, // Calories
                            { nutrientNumber: "203", value: 6.1 }, // Protein
                            { nutrientNumber: "204", value: 6.9 }, // Fat
                            { nutrientNumber: "205", value: 19.8 }, // Carbs
                            { nutrientNumber: "291", value: 1.2 }, // Fiber
                        ],
                        servingSize: 100,
                    },
                ]);
                (pickBestMatch as jest.Mock).mockReturnValueOnce({
                    description: "Macaroni and cheese, box mix, prepared",
                    foodNutrients: [
                        { nutrientNumber: "208", value: 164 },
                        { nutrientNumber: "203", value: 6.1 },
                        { nutrientNumber: "204", value: 6.9 },
                        { nutrientNumber: "205", value: 19.8 },
                        { nutrientNumber: "291", value: 1.2 },
                    ],
                    servingSize: 100,
                });

                const res = await request
                    .post("/get-calories")
                    .set("Authorization", `Bearer ${mockToken}`)
                    .send({ dish_name: "macaroni and cheese", servings: 1 });

                expect(res.status).toBe(200);
                expect(res.body.dish_name).toBe("Macaroni and cheese, box mix, prepared");
                expect(res.body.calories_per_serving).toBe(164);
                expect(res.body.total_calories).toBe(164);
            });

            it("should get calories for grilled salmon", async () => {
                const { searchFood, pickBestMatch } = require("../src/utils/usda-client");
                
                // Mock USDA response for grilled salmon
                (searchFood as jest.Mock).mockResolvedValueOnce([
                    {
                        description: "Salmon, Atlantic, farmed, cooked, dry heat",
                        foodNutrients: [{ nutrientNumber: "208", value: 206 }],
                        servingSize: 100,
                    },
                ]);
                (pickBestMatch as jest.Mock).mockReturnValueOnce({
                    description: "Salmon, Atlantic, farmed, cooked, dry heat",
                    foodNutrients: [{ nutrientNumber: "208", value: 206 }],
                    servingSize: 100,
                });

                const res = await request
                    .post("/get-calories")
                    .set("Authorization", `Bearer ${mockToken}`)
                    .send({ dish_name: "grilled salmon", servings: 1.5 });

                expect(res.status).toBe(200);
                expect(res.body.dish_name).toBe("Salmon, Atlantic, farmed, cooked, dry heat");
                expect(res.body.calories_per_serving).toBe(206);
                expect(res.body.total_calories).toBe(309); // 206 * 1.5
            });

            it("should get calories for paneer butter masala", async () => {
                const { searchFood, pickBestMatch } = require("../src/utils/usda-client");
                
                // Mock USDA response for paneer butter masala
                (searchFood as jest.Mock).mockResolvedValueOnce([
                    {
                        description: "Indian dish, paneer makhani (paneer butter masala)",
                        foodNutrients: [{ nutrientNumber: "208", value: 280 }],
                        servingSize: 150,
                    },
                ]);
                (pickBestMatch as jest.Mock).mockReturnValueOnce({
                    description: "Indian dish, paneer makhani (paneer butter masala)",
                    foodNutrients: [{ nutrientNumber: "208", value: 280 }],
                    servingSize: 150,
                });

                const res = await request
                    .post("/get-calories")
                    .set("Authorization", `Bearer ${mockToken}`)
                    .send({ dish_name: "paneer butter masala", servings: 2 });

                expect(res.status).toBe(200);
                expect(res.body.dish_name).toBe("Indian dish, paneer makhani (paneer butter masala)");
                expect(res.body.calories_per_serving).toBe(420); // (280/100) * 150
                expect(res.body.total_calories).toBe(840); // 420 * 2
            });
        });

        // Test multiple similar matches
        it("should handle multiple similar matches and pick the best one", async () => {
            const { searchFood, pickBestMatch } = require("../src/utils/usda-client");
            
            // Mock multiple similar results
            const multipleResults = [
                {
                    description: "Apple, raw, with skin",
                    foodNutrients: [{ nutrientNumber: "208", value: 52 }],
                    servingSize: 100,
                },
                {
                    description: "Apple juice, canned or bottled",
                    foodNutrients: [{ nutrientNumber: "208", value: 46 }],
                    servingSize: 100,
                },
                {
                    description: "Apple pie, commercially prepared",
                    foodNutrients: [{ nutrientNumber: "208", value: 237 }],
                    servingSize: 100,
                },
            ];
            
            (searchFood as jest.Mock).mockResolvedValueOnce(multipleResults);
            // Mock fuzzy matching to pick the best match (raw apple)
            (pickBestMatch as jest.Mock).mockReturnValueOnce(multipleResults[0]);

            const res = await request
                .post("/get-calories")
                .set("Authorization", `Bearer ${mockToken}`)
                .send({ dish_name: "apple", servings: 1 });

            expect(res.status).toBe(200);
            expect(res.body.dish_name).toBe("Apple, raw, with skin");
            expect(res.body.calories_per_serving).toBe(52);
            expect(pickBestMatch).toHaveBeenCalledWith(multipleResults, "apple");
        });

        // Test missing nutrition data
        it("should handle food with missing calories data", async () => {
            const { searchFood, pickBestMatch } = require("../src/utils/usda-client");
            
            (searchFood as jest.Mock).mockResolvedValueOnce([
                {
                    description: "Some food without calories",
                    foodNutrients: [{ nutrientNumber: "301", value: 10 }], // Not calories
                    servingSize: 100,
                },
            ]);
            (pickBestMatch as jest.Mock).mockReturnValueOnce({
                description: "Some food without calories",
                foodNutrients: [{ nutrientNumber: "301", value: 10 }],
                servingSize: 100,
            });

            const res = await request
                .post("/get-calories")
                .set("Authorization", `Bearer ${mockToken}`)
                .send({ dish_name: "unknown food", servings: 1 });

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty("error", "Calories data missing");
        });
    });
});
