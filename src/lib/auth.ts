import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

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

        const expectedEmail = process.env.CRM_EMAIL;
        const expectedHashB64 = process.env.CRM_PASSWORD_HASH_B64;
        if (!expectedEmail || !expectedHashB64) return null;
        const expectedHash = Buffer.from(expectedHashB64, "base64").toString("utf8");

        if (email.toLowerCase() !== expectedEmail.toLowerCase()) return null;

        const valid = await bcrypt.compare(password, expectedHash);
        if (!valid) return null;

        return { id: "owner", email: expectedEmail, name: "Owner" };
      },
    }),
  ],
});
