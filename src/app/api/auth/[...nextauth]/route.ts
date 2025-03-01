// src/app/api/auth/[...nextauth]/route.ts
import { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth/next";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabase";
import bcrypt from "bcrypt";

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
          // Query Supabase for the user with the provided email
          const { data: user, error } = await supabase
            .from('User')
            .select('id, email, name, password, avatar')
            .eq('email', credentials.email)
            .single();

          if (error || !user) {
            console.error("User lookup error:", error?.message);
            return null;
          }

          // Verify the password
          const passwordMatch = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!passwordMatch) {
            return null;
          }

          // Return the user data without sensitive information
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatar || null,
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