import { Router, Route, Navigate } from "@solidjs/router";
import { lazy } from "solid-js";

const Login = lazy(() => import("./pages/Login"));
const Me = lazy(() => import("./pages/Me"));
const Admin = lazy(() => import("./pages/Admin"));
const Live = lazy(() => import("./pages/Live"));

export function App() {
  return (
    <Router>
      <Route path="/" component={() => <Navigate href="/me" />} />
      <Route path="/login" component={Login} />
      <Route path="/me" component={Me} />
      <Route path="/admin" component={Admin} />
      <Route path="/live" component={Live} />
      <Route path="*" component={() => <Navigate href="/me" />} />
    </Router>
  );
}
