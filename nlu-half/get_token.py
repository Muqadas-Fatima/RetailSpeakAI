import json

import httpx

REGION = "ap-southeast-2"
CLIENT_ID = "5aa1bmna6tdamt86iv7qqgkeko"
URL = f"https://cognito-idp.{REGION}.amazonaws.com/"


def call(target, body):
    resp = httpx.post(
        URL,
        headers={
            "X-Amz-Target": f"AWSCognitoIdentityProviderService.{target}",
            "Content-Type": "application/x-amz-json-1.1",
        },
        json=body,
        timeout=15,
    )
    return resp.status_code, resp.json()


def show_token(data):
    print("\nACCESS TOKEN (copy everything below this line):\n")
    print(data["AuthenticationResult"]["AccessToken"])


email = input("Email: ").strip()
password = input("Password: ")

status, data = call("InitiateAuth", {
    "AuthFlow": "USER_PASSWORD_AUTH",
    "ClientId": CLIENT_ID,
    "AuthParameters": {"USERNAME": email, "PASSWORD": password},
})

if status != 200:
    print("FAILED:", data.get("__type"), "-", data.get("message"))
elif data.get("AuthenticationResult"):
    show_token(data)
elif data.get("ChallengeName") == "NEW_PASSWORD_REQUIRED":
    params = data.get("ChallengeParameters", {})
    username = params.get("USER_ID_FOR_SRP", email)
    required = json.loads(params.get("requiredAttributes", "[]"))

    print("\nThis user has a temporary password. Choose a NEW permanent password.")
    responses = {"USERNAME": username, "NEW_PASSWORD": input("New password: ")}
    for attr in required:
        name = attr.replace("userAttributes.", "")
        responses[attr] = input(f"Value for required attribute '{name}': ")

    status, data = call("RespondToAuthChallenge", {
        "ChallengeName": "NEW_PASSWORD_REQUIRED",
        "ClientId": CLIENT_ID,
        "Session": data["Session"],
        "ChallengeResponses": responses,
    })
    if status != 200:
        print("FAILED:", data.get("__type"), "-", data.get("message"))
    elif data.get("AuthenticationResult"):
        print("Password changed. Use the NEW password from now on.")
        show_token(data)
    else:
        print("Cognito wants another step:", data.get("ChallengeName"))
else:
    print("Cognito wants another step:", data.get("ChallengeName"))