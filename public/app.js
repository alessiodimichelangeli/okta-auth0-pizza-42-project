let auth0Client = null;

const fetchAuthConfig = () => fetch("/auth_config.json");

// FUNCTION TO SET UP CLIENT
const configureClient = async () => {
  const response = await fetchAuthConfig();
  const config = await response.json();

  auth0Client = await auth0.createAuth0Client({
    domain: config.domain,
    clientId: "NamXneKM2JSW7VmrOIJy9Lqh4In8DxEr", // IMPORTANT: Client ID of my single page APP 
    authorizationParams: {
      redirect_uri: window.location.origin,
      scope: "openid profile email create:orders",
      audience: config.audience
    }
  });
};


// FUNCTION TO SHOW NOTIFICATION
const showNotification = (message, type = 'success', duration = 0) => {
  const container = document.getElementById('notification-container');
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  // SUB FUNCTION TO REMOVE THE NOTIFICATION
  const dismiss = () => {
    notification.style.opacity = 0;
    setTimeout(() => {
      notification.remove();
    }, 400); // TIMEOUT TO DISMISS NOTIFICATION
  };

  // TO REMOVE NOTIFICATION BY CLICKING ON IT
  notification.addEventListener('click', dismiss);
  
  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
  
  container.appendChild(notification);
};



// FUNCTION TO UPDATE UI
const updateUI = async () => {

  const isAuthenticated = await auth0Client.isAuthenticated();

  // TO MANAGE ELEMENTS VISIBILITY
  // Show the "Logout" button if the user is logged in, otherwise hide it
  document.getElementById("logout").classList.toggle("hidden", !isAuthenticated);
  
  // Show the "Login" button if the user is NOT authenticated, otherwise hide it
  document.getElementById("login").classList.toggle("hidden", isAuthenticated);
  
  // TO MANAGE ELEMENTS VISIBILITY
  // document.getElementById("login").disabled = isAuthenticated;
  // document.getElementById("logout").disabled = !isAuthenticated;

  // TO MANAGE ELEMENTS VISIBILITY BASED ON LOGIN 
  document.querySelector(".welcome-message").classList.toggle("hidden", isAuthenticated);
  document.querySelector(".hero-image-container").classList.toggle("hidden", isAuthenticated); 
  document.getElementById("user-content").classList.toggle("hidden", !isAuthenticated);
  

  if (isAuthenticated) {
    // TO POPULATE THE USER PROFILE TABLE
    const user = await auth0Client.getUser();
    const profileTable = document.querySelector("#user-profile-table tbody");
    profileTable.innerHTML = ""; // TO CLEAN UP THE TABLE
    
    const profileProperties = {
      "name": user.name,
      "nickname": user.nickname,
      "email": user.email,
      "email verified": user.email_verified ? 'Sì ✅' : 'No ❌'
    };

    // THIS LOOP CREATES TWO CELLS PER ROW, ONE FOR THE KEY, ONE FOR THE VALUE
    for (const [key, value] of Object.entries(profileProperties)) {
      const row = profileTable.insertRow();
      const cellKey = row.insertCell(0);
      const cellValue = row.insertCell(1);
      
      cellKey.textContent = key;
      cellValue.textContent = value || 'N/D';
    }

    // TO POPULATE THE ORDER HISTORY TABLE
    const claims = await auth0Client.getIdTokenClaims();
    const orderHistory = claims['https://pizza42.com/orders'] || [];
    const historyTable = document.querySelector("#order-history-table tbody");
    historyTable.innerHTML = "";

    document.getElementById("no-orders-message").classList.toggle("hidden", orderHistory.length > 0);
    document.querySelector("#order-history-table").classList.toggle("hidden", orderHistory.length === 0);

    orderHistory.forEach(order => {
      const row = historyTable.insertRow();
      const cell1 = row.insertCell(0);
      const cell2 = row.insertCell(1);
      
      cell1.setAttribute('data-label', 'Pizza');
      cell1.textContent = order.pizza;

      cell2.setAttribute('data-label', 'Data');
      cell2.textContent = new Date(order.date).toLocaleString('it-IT');
    });
  }
};


// FUNCTION TO PLACE THE PIZZA ORDER 
const placeOrder = async (pizzaData) => {
  try {
    // GET TOKEN
    const token = await auth0Client.getTokenSilently({
      authorizationParams: {
        scope: "create:orders" //AUTH0 SCOPE
      },
      cacheMode: 'off'
    });

    // CALL API 
    const response = await fetch("/api/orders", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(pizzaData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message);
    }

    // SHOW SUCCESS NOTIFICATION 
    showNotification("Operation: Dinner is a Go! Pizza's been ordered, folks.", "success",5000);
    
  } catch (error) {
    // SHOW ERROR NOTIFICATION 
    if (error.error === 'login_required' || error.error === 'consent_required') {
      await auth0Client.loginWithRedirect();
    } else {
      console.error("ERROR placing the order: ", error);
      showNotification(`ERROR placing the order: ${error.message}`, "error",5000);
    }
  }
};


// ON LOAD PAGE
window.onload = async () => {
  await configureClient();

  updateUI(); // UPDATE UI

  if (location.search.includes("state=") && location.search.includes("code=")) {
    try {
      await auth0Client.handleRedirectCallback();
    } catch (e) {
      console.error(e);
    }
    window.history.replaceState({}, document.title, "/");
    updateUI(); // UPDATE UI
  }

  document.getElementById("login").addEventListener("click", () => auth0Client.loginWithRedirect());
  document.getElementById("logout").addEventListener("click", () => auth0Client.logout());
  
  document.getElementById("order-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const selectedPizza = document.getElementById("pizza-select").value;
    placeOrder({ pizza: selectedPizza });
  });
};