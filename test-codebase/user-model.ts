/**
 * User Model
 * Represents a user in the system with authentication data
 */

export interface UserData {
  id?: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'user' | 'moderator';
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

export class User {
  public id: string;
  public email: string;
  public password: string;
  public firstName?: string;
  public lastName?: string;
  public role: 'admin' | 'user' | 'moderator';
  public isActive: boolean;
  public lastLoginAt?: Date;
  public createdAt: Date;
  public updatedAt?: Date;

  constructor(data: UserData) {
    this.id = data.id || this.generateId();
    this.email = data.email;
    this.password = data.password;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.role = data.role;
    this.isActive = data.isActive;
    this.lastLoginAt = data.lastLoginAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Find user by email address
   */
  static async findByEmail(email: string): Promise<User | null> {
    // This would typically query a database
    // For testing, we'll simulate a database lookup
    const userData = await this.simulateDbQuery('email', email);
    return userData ? new User(userData) : null;
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const userData = await this.simulateDbQuery('id', id);
    return userData ? new User(userData) : null;
  }

  /**
   * Save user to database
   */
  async save(): Promise<User> {
    this.updatedAt = new Date();
    // This would typically save to a database
    return this;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(): Promise<void> {
    this.lastLoginAt = new Date();
    await this.save();
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: string): boolean {
    return this.role === role;
  }

  /**
   * Get user's full name
   */
  getFullName(): string {
    return [this.firstName, this.lastName].filter(Boolean).join(' ') || this.email;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private static async simulateDbQuery(field: string, value: string): Promise<UserData | null> {
    // Simulate database delay
    await new Promise(resolve => setTimeout(resolve, 10));
    return null; // Would return actual user data
  }
}