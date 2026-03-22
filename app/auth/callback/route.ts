import { NextResponse } from "next/server";
import { finalizeGitHubAuth } from "@/src/services/auth/service";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  const nextParam = searchParams.get("next");
  const nextPath =
    nextParam && nextParam.startsWith("/")
      ? nextParam
      : "/repositories";

  if (errorParam) {
    return NextResponse.redirect(`${origin}/?error=${errorParam}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=missing_code`);
  }

  try {
    await finalizeGitHubAuth(code);
  } catch {
    return NextResponse.redirect(`${origin}/?error=oauth_failed`);
  }

  return NextResponse.redirect(`${origin}${nextPath}`);
}
