/* @refresh reload */
import { render } from "solid-js/web";
import ui from "beercss";
import "material-dynamic-colors";
import "@fontsource/mountains-of-christmas/400.css";
import "@fontsource/mountains-of-christmas/700.css";
import "./styles/base.css";
import { App } from "./App";

// BeerCSS theme from a seed colour; dark mode suits a party (and the TV).
// Set once here — Solid never touches <body> attributes, so BeerCSS's body
// observer and Solid's rendering don't fight.
void ui("theme", "#b71c1c");
ui("mode", "dark");

render(() => <App />, document.getElementById("root")!);
