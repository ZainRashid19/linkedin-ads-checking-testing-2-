"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, SHARE_COOKIE, passwordMatches, sessionToken } from "../../lib/auth";

export async function login(formData: FormData) {
  const attempt = String(formData.get("password") ?? "");
  await new Promise(r => setTimeout(r, 600)); // slows down guessing
  if (!(await passwordMatches(attempt))) redirect("/login?error=1");
  (await cookies()).set(COOKIE, await sessionToken(), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  (await cookies()).delete(SHARE_COOKIE);
  redirect("/login");
}
