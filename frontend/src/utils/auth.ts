interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface UserProfile {
  id: string;
  role: "PLAYER" | "COACH" | "ADMIN";
  name: string;
  email: string;
  phone?: string;
  profile_bio?: string;
  jersey_number?: number;
  team?: string;
  is_verified: boolean;
  created_at: string;
  last_login?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const authService = {
  // Store authentication tokens
  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
  },

  // Get access token
  getAccessToken(): string | null {
    return localStorage.getItem("access_token");
  },

  // Get refresh token
  getRefreshToken(): string | null {
    return localStorage.getItem("refresh_token");
  },

  // Store user profile
  setUserProfile(profile: UserProfile) {
    localStorage.setItem("user_profile", JSON.stringify(profile));
  },

  // Get user profile
  getUserProfile(): UserProfile | null {
    const profile = localStorage.getItem("user_profile");
    return profile ? JSON.parse(profile) : null;
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },

  // Get current user role
  getUserRole(): "PLAYER" | "COACH" | "ADMIN" | null {
    const profile = this.getUserProfile();
    return profile?.role || null;
  },

  // Clear all auth data (logout)
  clearAuth() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_profile");
  },

  // Make authenticated API request
  async authenticatedFetch(url: string, options: RequestInit = {}) {
    const token = this.getAccessToken();

    if (!token) {
      throw new Error("No access token available");
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    // If token expired, try to refresh
    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        // Retry with new token
        const newToken = this.getAccessToken();
        return fetch(`${API_BASE_URL}${url}`, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
            "Content-Type": "application/json",
          },
        });
      } else {
        // Refresh failed, logout
        this.clearAuth();
        window.location.href = "/login";
        throw new Error("Session expired");
      }
    }

    return response;
  },

  //  Refresh access token using refresh token
  async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const data: TokenResponse = await response.json();
        this.setTokens(data.access_token, data.refresh_token);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Token refresh failed:", error);
      return false;
    }
  },

  // Logout user
  async logout() {
    const refreshToken = this.getRefreshToken();

    if (refreshToken) {
      try {
        await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch (error) {
        console.error("Logout request failed:", error);
      }
    }

    this.clearAuth();
    window.location.href = "/login";
  },
};
