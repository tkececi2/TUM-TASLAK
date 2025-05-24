import { User } from 'firebase/auth';
import { userService } from './userService';
import { storageService } from './storageService';
import type { Kullanici } from '../types';

export class AuthService {
  private static instance: AuthService;
  private currentUser: Kullanici | null = null;

  private constructor() {
    this.currentUser = storageService.getUser();
    
    // Sahalar dizisini kontrol et
    if (this.currentUser?.sahalar) {
      if (!Array.isArray(this.currentUser.sahalar)) {
        // Eğer sahalar bir dizi değilse, dizi haline getir
        this.currentUser.sahalar = Object.keys(this.currentUser.sahalar);
      }
    } else if (this.currentUser) {
      // Sahalar yoksa boş dizi oluştur
      this.currentUser.sahalar = [];
    }
    
    // Ensure companyId exists
    if (this.currentUser && !this.currentUser.companyId) {
      this.currentUser.companyId = '';
    }
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async getUserProfile(user: User): Promise<Kullanici | null> {
    try {
      const userData = await userService.getUserById(user.uid);
      if (userData) {
        // Sahalar dizisini kontrol et
        if (userData.sahalar) {
          if (!Array.isArray(userData.sahalar)) {
            // Eğer sahalar bir dizi değilse, dizi haline getir
            userData.sahalar = Object.keys(userData.sahalar);
          }
        } else {
          // Sahalar yoksa boş dizi oluştur
          userData.sahalar = [];
        }
        
        // Ensure companyId exists
        if (!userData.companyId) {
          userData.companyId = '';
        }
        
        this.setCurrentUser(userData);
      }
      return userData;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  public getCurrentUser(): Kullanici | null {
    if (!this.currentUser) {
      this.currentUser = storageService.getUser();
      
      // Abonelik süresini kontrol et
      if (this.currentUser?.odemeDurumu === 'surebitti') {
        console.warn('Süresi bitmiş kullanıcı giriş yapmaya çalışıyor:', this.currentUser.email);
        this.clearUserData();
        return null;
      }
      
      // Sahalar dizisini kontrol et
      if (this.currentUser?.sahalar) {
        if (!Array.isArray(this.currentUser.sahalar)) {
          // Eğer sahalar bir dizi değilse, dizi haline getir
          this.currentUser.sahalar = Object.keys(this.currentUser.sahalar);
        }
      } else if (this.currentUser) {
        // Sahalar yoksa boş dizi oluştur
        this.currentUser.sahalar = [];
      }
      
      // Ensure companyId exists
      if (this.currentUser && !this.currentUser.companyId) {
        this.currentUser.companyId = '';
      }
    }
    return this.currentUser;
  }

  public setCurrentUser(user: Kullanici | null): void {
    // Sahalar dizisini kontrol et
    if (user?.sahalar) {
      if (!Array.isArray(user.sahalar)) {
        // Eğer sahalar bir dizi değilse, dizi haline getir
        user.sahalar = Object.keys(user.sahalar);
      }
    } else if (user) {
      // Sahalar yoksa boş dizi oluştur
      user.sahalar = [];
    }
    
    // Ensure companyId exists
    if (user && !user.companyId) {
      user.companyId = '';
    }
    
    this.currentUser = user;
    if (user) {
      storageService.saveUser(user);
    } else {
      storageService.clearUser();
    }
  }

  public clearUserData(): void {
    this.currentUser = null;
    storageService.clearUser();
  }

  public validateStoredUser(uid: string): boolean {
    return storageService.validateStoredUser(uid);
  }

  public isLoggedOut(): boolean {
    return storageService.isLoggedOut();
  }
}

export const authService = AuthService.getInstance();