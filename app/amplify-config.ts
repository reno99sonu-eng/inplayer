import { Amplify } from "aws-amplify";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "ap-southeast-2_36G5R1WuZ",
      userPoolClientId: "76299q1n17bk11rcpojf1372hr",
      loginWith: {
        email: true,
      },
    },
  },
});