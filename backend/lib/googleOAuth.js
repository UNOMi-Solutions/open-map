import { OAuth2Client } from "google-auth-library";

// `expose` marks messages written for end users. google-auth-library errors
// also carry a `status`, but their messages ("invalid_grant") are not.
function configError() {
  const err = new Error("Google Sign-In is not configured on the server.");
  err.status = 503;
  err.expose = true;
  return err;
}

function authError(message, status = 401) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

/**
 * GIS popup mode (`ux_mode: "popup"`) exchanges the auth code with
 * redirect_uri=postmessage. The Cloud Console client must be a Web
 * application whose JavaScript origins include the frontend origin.
 */
function getCodeClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw configError();
  return new OAuth2Client(clientId, clientSecret, "postmessage");
}

async function payloadFromIdToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw configError();
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });
  return ticket.getPayload();
}

/**
 * Turns a Google Identity Services auth code (or ID token) into a verified
 * profile. Never trust email/name values sent by the browser — Google is the
 * source of truth here.
 */
export async function loadGoogleProfile({ code, credential } = {}) {
  let payload;

  if (typeof credential === "string" && credential.trim()) {
    payload = await payloadFromIdToken(credential.trim());
  } else if (typeof code === "string" && code.trim()) {
    const client = getCodeClient();
    const { tokens } = await client.getToken(code.trim());
    if (!tokens.id_token) {
      throw authError("Google did not return an ID token.");
    }
    payload = await payloadFromIdToken(tokens.id_token);
  } else {
    throw authError("A Google authorization code is required.", 400);
  }

  if (!payload?.sub) {
    throw authError("Could not verify Google sign-in.");
  }

  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email) {
    throw authError("Google did not provide an email address for this account.", 400);
  }
  if (payload.email_verified !== true) {
    throw authError("Please verify your Google email address, then try again.", 403);
  }

  const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 80) : "";

  return {
    googleId: payload.sub,
    email,
    name,
  };
}
