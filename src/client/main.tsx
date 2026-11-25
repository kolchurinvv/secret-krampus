/* @refresh reload */
import { render } from "solid-js/web";
import ui from "beercss";
import "material-dynamic-colors";
import "@fontsource/mountains-of-christmas/400.css";
import "@fontsource/mountains-of-christmas/700.css";
// Mountains of Christmas has no Cyrillic. Only the Cyrillic subsets of these
// are loaded, so Latin text keeps the original look and Russian text falls
// through to a matching festive face (see --sk-display in base.css).
import "@fontsource/kurale/cyrillic-400.css";
import "@fontsource/kurale/cyrillic-ext-400.css";
import "@fontsource/rubik-wet-paint/cyrillic-400.css";
import "@fontsource/rubik-wet-paint/cyrillic-ext-400.css";
import "./styles/base.css";
import { App } from "./App";

// BeerCSS theme from a seed colour; dark mode suits a party (and the TV).
// Set once here — Solid never touches <body> attributes, so BeerCSS's body
// observer and Solid's rendering don't fight.
void ui("theme", "#b71c1c");
ui("mode", "dark");

render(() => <App />, document.getElementById("root")!);
