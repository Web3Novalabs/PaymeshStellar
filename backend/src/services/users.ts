import crypto from 'crypto';

export interface User {
  id: string;
  address: string;
  name: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsersService {
  create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  getById(id: string): Promise<User | null>;
  getByAddress(address: string): Promise<User | null>;
  update(
    id: string,
    userData: Partial<Omit<User, 'id' | 'address' | 'createdAt'>>
  ): Promise<User | null>;
  clear(): Promise<void>; // utility for tests
}

export class InMemoryUsersService implements UsersService {
  private users: User[] = [];

  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(user);
    return user;
  }

  async getById(id: string): Promise<User | null> {
    const user = this.users.find((u) => u.id === id);
    return user || null;
  }

  async getByAddress(address: string): Promise<User | null> {
    const user = this.users.find((u) => u.address === address);
    return user || null;
  }

  async update(
    id: string,
    userData: Partial<Omit<User, 'id' | 'address' | 'createdAt'>>
  ): Promise<User | null> {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return null;

    const existing = this.users[index];
    const updated: User = {
      ...existing,
      ...userData,
      updatedAt: new Date(),
    };

    this.users[index] = updated;
    return updated;
  }

  async clear(): Promise<void> {
    this.users = [];
  }
}

export const usersService: UsersService = new InMemoryUsersService();
