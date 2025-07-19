const express = require("express");
const { join } = require("path");
const morgan = require("morgan");
const helmet = require("helmet");
const { auth } = require("express-oauth2-jwt-bearer");
const { ManagementClient } = require("auth0");

require('dotenv').config(); 

const app = express();

// FUNCTIONS TO SET UP AUTH0 
const auth0Config = {
  domain: process.env.AUTH0_DOMAIN,
  audience: process.env.AUTH0_AUDIENCE,
};

const managementClient = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
  clientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
});

const checkJwt = auth({
  audience: auth0Config.audience,
  issuerBaseURL: `https://${auth0Config.domain}/`,
  tokenSigningAlg: 'RS256'
});

// APP USE
app.use(morgan("dev"));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "cdn.auth0.com"],
        "connect-src": ["'self'", process.env.AUTH0_DOMAIN],   //"connect-src": ["'self'", "dev-sdgysnf3f0qu6p7d.eu.auth0.com"],
        "frame-src": [process.env.AUTH0_DOMAIN],    //"frame-src": ["dev-sdgysnf3f0qu6p7d.eu.auth0.com"], 
      },
    },
  })
);
app.use(express.static(join(__dirname, "public")));
app.use(express.json());

//APP GET
app.get("/auth_config.json", (req, res) => {
  res.json(auth0Config);
});




// APP POST 
app.post("/api/orders", checkJwt, async (req, res) => {
  const { payload } = req.auth;
  console.log(payload.email_verified);
  if (!payload['https://pizza42.com/email_verified']) {
    return res.status(403).json({ 
      message: "Access Denied: Please verify your email before placing an order." 
    });
  }

  const scopes = payload.scope ? payload.scope.split(' ') : [];
  if (!scopes.includes('create:orders')) {
    return res.status(403).json({
      message: "Insufficient permissions: The scope 'create:orders' is required."
    });
  }

  try {
    const userId = payload.sub;
    const newOrder = req.body;
    
    // 1. Retrieve the entire user object
    const userResponse = await managementClient.users.get({ id: userId });
    
    // 2. Check if app_metadata exists, otherwise use an empty {} object.
    const app_metadata = userResponse.data.app_metadata || {};
    
    // 3. Now is possible to safely read the 'orders' property.
    const existingOrders = app_metadata.orders || [];

    // 4. Create the update orders variable
    const updatedOrders = [...existingOrders, { ...newOrder, date: new Date().toISOString() }];
    
    // Update the user orders
    await managementClient.users.update({ id: userId }, { app_metadata: { orders: updatedOrders } });
    
    res.status(201).json({ 
      message: "Order successfully created and saved to your profile.",
      order: newOrder
    });
  } catch (error) {
    console.error("Error updating metadata: ", error);
    res.status(500).json({ message: "Internal Server Error." });
  }
});
// END OF APP POST



// Define a "catch-all" route that intercepts any GET requests not handled by the paths defined before it and responds by always sending the index.html file.
app.get("/*", (_, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

// Server listening...
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`🚀 Server in ascolto su http://localhost:${port}`);
});