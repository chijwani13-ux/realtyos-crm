import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isWithinAccessWindow } from "@/lib/accessWindow";

export class OutsideAccessHoursError extends CredentialsSignin {
  code = "OutsideAccessHours";
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
      accessStart?: string | null;
      accessEnd?: string | null;
    };
  }
  interface User {
    role?: string;
    accessStart?: string | null;
    accessEnd?: string | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        if (user.role === "Employee" && !isWithinAccessWindow(user.accessStart, user.accessEnd)) {
          throw new OutsideAccessHoursError();
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          accessStart: user.accessStart,
          accessEnd: user.accessEnd,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.accessStart = user.accessStart;
        token.accessEnd = user.accessEnd;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.role = (token.role as string) || "Owner";
        session.user.id = token.sub as string;
        session.user.accessStart = (token.accessStart as string | null) ?? null;
        session.user.accessEnd = (token.accessEnd as string | null) ?? null;
      }
      return session;
    },
  },
});
