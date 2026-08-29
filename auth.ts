import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeGuardianOperator } from "@/lib/guardian/operator-auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: process.env.AUTH_DEBUG === "true",
  pages: {
    signIn: "/login"
  },
  session: {
    strategy: "jwt"
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      authorize: authorizeGuardianOperator
    })
  ],
  callbacks: {
    authorized({ auth: session, request }) {
      const isProtectedAppRoute = request.nextUrl.pathname.startsWith("/app");
      if (!isProtectedAppRoute) {
        return true;
      }

      return Boolean(session?.user);
    }
  }
});
