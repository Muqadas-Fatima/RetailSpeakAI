
import {
  signIn,
  signUp,
  confirmSignUp,
  resendSignUpCode,
  signOut,
  fetchAuthSession,
  getCurrentUser,
  resetPassword,
  confirmResetPassword,
  signInWithRedirect,
} from "aws-amplify/auth";

export async function registerUser(data: {
  fullName: string;
  email: string;
  password: string;
}) {
  return signUp({
    username: data.email.trim().toLowerCase(),
    password: data.password,
    options: {
      userAttributes: {
        email: data.email.trim().toLowerCase(),
        name: data.fullName.trim(),
        profile: "customer",
      },
    },
  });
}

export async function verifyEmail(email: string, code: string) {
  return confirmSignUp({
    username: email.trim().toLowerCase(),
    confirmationCode: code.trim(),
  });
}

export async function resendVerificationCode(email: string) {
  return resendSignUpCode({
    username: email.trim().toLowerCase(),
  });
}

export async function loginUser(email: string, password: string) {
  return signIn({
    username: email.trim().toLowerCase(),
    password,
  });
}

export async function logoutUser() {
  await signOut();
}

export async function getAccessToken(): Promise<string | null> {
  const session = await fetchAuthSession();
  return session.tokens?.accessToken?.toString() ?? null;
}

export async function getIdToken(): Promise<string | null> {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString() ?? null;
}

export async function getAuthenticatedUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

export async function startPasswordReset(email: string) {
  return resetPassword({
    username: email.trim().toLowerCase(),
  });
}

export async function finishPasswordReset(
  email: string,
  code: string,
  newPassword: string
) {
  return confirmResetPassword({
    username: email.trim().toLowerCase(),
    confirmationCode: code.trim(),
    newPassword,
  });
}

/* ---- Used by src/app/signin/page.tsx ---- */

export async function cognitoSignIn(username: string, password: string) {
  return signIn({
    username: username.trim().toLowerCase(),
    password,
  });
}

export async function cognitoSession(): Promise<{
  email: string;
  role: "customer" | "owner";
}> {
  const session = await fetchAuthSession();
  const payload = (session.tokens?.idToken?.payload ?? {}) as Record<string, unknown>;
  const groups = (payload["cognito:groups"] as string[] | undefined) ?? [];
  const rawRole =
    (payload["custom:role"] as string | undefined) ??
    (payload["profile"] as string | undefined) ??
    groups[0];

  return {
    email: String(payload["email"] ?? ""),
    role: rawRole === "owner" ? "owner" : "customer",
  };
}

export async function cognitoSocialSignIn(provider: "Google" | "Facebook") {
  return signInWithRedirect({ provider });
}