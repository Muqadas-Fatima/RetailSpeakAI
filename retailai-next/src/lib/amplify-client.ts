
import { Amplify } from "aws-amplify";

const awsRegion = process.env.NEXT_PUBLIC_COGNITO_REGION!;
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!;
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!;
const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN!;

if (
  typeof window !== "undefined" &&
  awsRegion &&
  userPoolId &&
  userPoolClientId
) {
  Amplify.configure(
    {
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,
          loginWith: {
            email: true,
            oauth: {
              domain: cognitoDomain,
              scopes: ["openid", "email", "phone"],
              redirectSignIn: [
                process.env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN!,
              ],
              redirectSignOut: [
                process.env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT!,
              ],
              responseType: "code",
            },
          },
        },
      },
    },
    { ssr: false }
  );
}
