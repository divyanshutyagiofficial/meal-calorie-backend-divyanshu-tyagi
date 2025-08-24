// tests/auth.controller.test.ts
import supertest from "supertest";
import app from "../src/app";
import { userRepository } from "../src/repositories/user.repository";
import jwt from "jsonwebtoken";
import { MongoError } from "mongodb";
import dotenv from "dotenv";

dotenv.config();
process.env.JWT_SECRET = process.env.JWT_SECRET || "testsecret";

jest.mock("../src/repositories/user.repository", () => ({
    userRepository: {
        save: jest.fn(),
        findByEmail: jest.fn(),
    },
}));

jest.mock("jsonwebtoken", () => ({
    sign: jest.fn().mockReturnValue("mock-token"),
}));

const request = supertest(app);

describe("Auth Endpoints", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("POST /register", () => {
        const validPayload = {
            firstName: "Alice",
            lastName: "Smith",
            email: "alice@example.com",
            password: "Password1!",
        };

        it("should register a new user successfully", async () => {
            (userRepository.save as jest.Mock).mockResolvedValue({
                _id: "user123",
            });

            const res = await request.post("/auth/register").send(validPayload);

            expect(res.status).toBe(201);
            expect(res.body).toEqual({
                message: "User registered successfully",
                token: "mock-token",
            });
            expect(userRepository.save).toHaveBeenCalledWith(validPayload);
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: "user123" },
                expect.any(String),
                { expiresIn: "1h" }
            );
        });

        it("should return 400 if email is already in use", async () => {
            // simulate duplicate-key error from Mongo
            const dupError = new MongoError("dup key");
            (dupError as any).code = 11000;
            (userRepository.save as jest.Mock).mockRejectedValue(dupError);

            const res = await request.post("/auth/register").send(validPayload);

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: "Email already in use" });
            expect(userRepository.save).toHaveBeenCalled();
        });

        it("should return 400 for validation failures", async () => {
            // missing password, invalid email, etc.
            const res = await request.post("/auth/register").send({
                firstName: "",
                lastName: "No",
                email: "not-an-email",
                // password omitted
            });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error", "Validation failed");
            expect(res.body).toHaveProperty("details");
            expect(Array.isArray(res.body.details)).toBe(true);
            // save should never be called
            expect(userRepository.save).not.toHaveBeenCalled();
        });
    });

    describe("POST /login", () => {
        const loginPayload = {
            email: "alice@example.com",
            password: "Password1!",
        };
        const mockUser = {
            _id: "user123",
            comparePassword: jest.fn(),
        };

        it("should log in successfully and return a token", async () => {
            (userRepository.findByEmail as jest.Mock).mockResolvedValue(
                mockUser
            );
            (mockUser.comparePassword as jest.Mock).mockResolvedValue(true);

            const res = await request.post("/auth/login").send(loginPayload);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ token: "mock-token" });
            expect(userRepository.findByEmail).toHaveBeenCalledWith(
                loginPayload.email
            );
            expect(mockUser.comparePassword).toHaveBeenCalledWith(
                loginPayload.password
            );
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: mockUser._id },
                expect.any(String),
                { expiresIn: "1h" }
            );
        });

        it("should reject non-existent user with 401", async () => {
            (userRepository.findByEmail as jest.Mock).mockResolvedValue(null);

            const res = await request.post("/auth/login").send(loginPayload);

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: "Invalid credentials" });
            // comparePassword never called
            expect(mockUser.comparePassword).not.toHaveBeenCalled();
        });

        it("should reject wrong password with 401", async () => {
            (userRepository.findByEmail as jest.Mock).mockResolvedValue(
                mockUser
            );
            (mockUser.comparePassword as jest.Mock).mockResolvedValue(false);

            const res = await request.post("/auth/login").send(loginPayload);

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: "Invalid credentials" });
        });

        it("should return 400 for validation failures", async () => {
            // missing password
            const res = await request.post("/auth/login").send({
                email: "bad-email",
            });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error", "Validation failed");
            expect(res.body).toHaveProperty("details");
            expect(Array.isArray(res.body.details)).toBe(true);
            // findByEmail never called
            expect(userRepository.findByEmail).not.toHaveBeenCalled();
        });
    });
});
