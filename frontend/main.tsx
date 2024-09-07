import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "react-query";
import SuperTokens, { SuperTokensWrapper } from "supertokens-auth-react";
import ThirdPartyEmailPassword from "supertokens-auth-react/recipe/thirdpartyemailpassword";
import Session from "supertokens-auth-react/recipe/session";
import App from "./App.tsx";
import "./index.css";
const queryClient = new QueryClient();

SuperTokens.init({
  appInfo: {
    // learn more about this on https://supertokens.com/docs/thirdpartyemailpassword/appinfo
    appName: "ModelPad",
    apiDomain: import.meta.env.VITE_AUTH_API_DOMAIN || "https://modelpad.app",
    websiteDomain:
      import.meta.env.VITE_AUTH_FRONT_END_DOMAIN || "https://modelpad.app",
    apiBasePath: "/api/auth",
    websiteBasePath: "/auth",
  },
  recipeList: [
    ThirdPartyEmailPassword.init({
      signInAndUpFeature: {
        providers: [],
      },
    }),
    Session.init(),
  ],
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuperTokensWrapper>
        <App />
      </SuperTokensWrapper>
    </QueryClientProvider>
  </React.StrictMode>
);
