// src/app/api/auth/[...nextauth]/route.ts
import { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth/next";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabase";

// At the top of your [...nextauth]/route.ts file
console.log("NextAuth API route is being executed");
// Add custom types for NextAuth
declare module "next-auth" {
  interface User {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        
        try {
          // Use Supabase Auth for authentication
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (authError || !authData.user) {
            console.error("Authentication error:", authError?.message);
            return null;
          }

          // Get additional user info from your User table if needed
          const { data: userData, error: userError } = await supabase
            .from('User')
            .select('id, name, email, avatar')
            .eq('id', authData.user.id)
            .single();

          if (userError) {
            console.error("User lookup error:", userError.message);
            // Still proceed with auth data if user table lookup fails
          }

          // Return the user data
          return {
            id: authData.user.id,
            email: authData.user.email || '',
            name: userData?.name || authData.user.email?.split('@')[0] || 'User',
            image: userData?.avatar || null,
          };
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      // Add user ID to the JWT when a user signs in
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Add user ID to the session from the token
      if (session.user) {
        session.user.id = token.id;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
    newUser: "/register",
    error: "/login", // Custom error page, redirects to login with error param
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };