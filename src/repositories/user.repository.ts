import User, { IUser } from "../models/user.model";

type CreateUserInput = {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
};

export class UserRepository {
    async save(userData: CreateUserInput): Promise<IUser> {
        const user = new User(userData);
        await user.save();
        return user;
    }

    async findByEmail(email: string): Promise<IUser | null> {
        return User.findOne({ email });
    }
}

export const userRepository = new UserRepository();
