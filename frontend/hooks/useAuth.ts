import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

interface AuthResponse {
  user: User;
}

const API_DOMAIN =
  import.meta.env.VITE_AUTH_API_DOMAIN || "https://modelpad.app";

async function fetchMe(): Promise<User | null> {
  try {
    const response = await fetch(`${API_DOMAIN}/api/auth/me`, {
      credentials: "include",
    });
    if (!response.ok) {
      return null;
    }
    const data: AuthResponse = await response.json();
    return data.user;
  } catch {
    return null;
  }
}

async function loginUser(email: string, password: string): Promise<User> {
  const response = await fetch(`${API_DOMAIN}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Login failed");
  }
  
  const data: AuthResponse = await response.json();
  return data.user;
}

async function registerUser(email: string, password: string): Promise<User> {
  const response = await fetch(`${API_DOMAIN}/api/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Registration failed");
  }
  
  const data: AuthResponse = await response.json();
  return data.user;
}

async function logoutUser(): Promise<void> {
  const response = await fetch(`${API_DOMAIN}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Logout failed");
  }
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["auth-user"],
    queryFn: fetchMe,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginUser(email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(["auth-user"], user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      registerUser(email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(["auth-user"], user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.setQueryData(["auth-user"], null);
      queryClient.clear(); // Clear all cached data on logout
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    loginError: loginMutation.error as Error | null,
    registerError: registerMutation.error as Error | null,
  };
}
