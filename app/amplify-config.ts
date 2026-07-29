import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { sessionStorage as amplifySessionStorage } from "aws-amplify/utils";

// "Continue with Google" needs a Cognito Hosted UI domain with Google added
// as a federated identity provider (configured in the AWS Cognito console).
// Once that exists, set NEXT_PUBLIC_COGNITO_DOMAIN (e.g.
// "inplayer.auth.ap-southeast-2.amazoncognito.com") and the Google buttons
// come alive; until then they show a friendly "not set up yet" message.
const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;

// Comma-separated list of allowed redirect origins for OAuth (local dev +
// the deployed site). Must exactly match the callback URLs configured on
// the Cognito app client.
const appUrls = (
  process.env.NEXT_PUBLIC_APP_URLS || "http://localhost:3000/"
)
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "ap-south-1_OrIhWadFN",
      userPoolClientId: "1ckejhd5mp3oohgsfuqseeda5t",
      loginWith: cognitoDomain
        ? {
            email: true,
            oauth: {
              domain: cognitoDomain,
              // "aws.cognito.signin.user.admin" is the one that matters
              // here: it's what lets a token obtained through this OAuth/
              // Hosted-UI flow call fetchUserAttributes() afterward.
              // Without it, Cognito issues the Google sign-in tokens fine
              // (the person really is authenticated — that's why a repeat
              // attempt correctly said "already signed in"), but
              // AuthProvider's refreshUser() then calls
              // fetchUserAttributes() to build the user object and gets
              // "NotAuthorizedException: Access Token does not have
              // required scopes" — which it (until this session) caught
              // silently and just showed Sign In for. Email/password
              // sign-in was never affected because that path doesn't get
              // its access token through this OAuth scopes list at all.
              scopes: ["openid", "email", "profile", "aws.cognito.signin.user.admin"],
              redirectSignIn: appUrls,
              redirectSignOut: appUrls,
              responseType: "code",
              providers: ["Google"],
            },
          }
        : { email: true },
    },
  },
});

// Honor "Remember me": when the viewer signed in with it UNCHECKED, their
// tokens live in sessionStorage (cleared when the browser closes) instead
// of localStorage. This must be applied at boot — before any auth call —
// so reloads within the same browser session still find the tokens.
if (typeof window !== "undefined") {
  try {
    if (window.localStorage.getItem("inplayer-remember-me") === "0") {
      cognitoUserPoolsTokenProvider.setKeyValueStorage(amplifySessionStorage);
    }
  } catch {
    // Storage unavailable (private mode etc.) — default behavior is fine.
  }
}
